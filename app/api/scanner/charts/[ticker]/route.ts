import { NextResponse } from 'next/server';
import { loadChartData, loadChartManifest } from '@/lib/charts/load-chart-data';
import { requireScannerSession, type ScannerUser } from '@/lib/scanner-auth';

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

    // Our in-house chart payload (prices + fundamentals) is sourced from a
    // licensed provider that we may not redistribute. Only the owner/developer
    // role receives it; everyone else uses the TradingView widget client-side.
    if (user.role !== 'developer') {
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
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load chart data.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
