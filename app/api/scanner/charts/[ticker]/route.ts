import { NextResponse } from 'next/server';
import { loadChartData, loadChartManifest } from '@/lib/charts/load-chart-data';
import { canAccessDreamTreeChartData } from '@/lib/scanner-chart-access';
import { requireScannerSession, type ScannerUser } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

const LOCAL_PREVIEW_USER: ScannerUser = {
  email: 'local-preview@dev',
  role: 'developer',
};

async function resolveChartUser(): Promise<ScannerUser | null> {
  const user = await requireScannerSession();
  if (user) return user;
  if (process.env.NODE_ENV === 'development') {
    const manifest = await loadChartManifest();
    if (manifest?.tickers?.length) return LOCAL_PREVIEW_USER;
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await params;

  try {
    const user = await resolveChartUser();
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    // Dream Tree OHLC is licensed for display to members only after redistribution
    // terms are in place (Tiingo etc.). Set SCANNER_DREAM_TREE_CHARTS_FOR_MEMBERS=true.
    if (!canAccessDreamTreeChartData(user)) {
      return NextResponse.json(
        { error: 'Chart data is restricted for this account.', restricted: true },
        { status: 403 },
      );
    }

    const data = await loadChartData(ticker);
    if (!data) {
      return NextResponse.json(
        { error: `Chart not available for ${ticker.toUpperCase()}.` },
        { status: 404 },
      );
    }
    const attribution = process.env.SCANNER_CHART_DATA_ATTRIBUTION?.trim() || null;
    return NextResponse.json({ user, data, attribution });

  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load chart data.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
