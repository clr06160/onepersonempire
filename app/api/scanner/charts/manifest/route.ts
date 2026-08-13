import { NextResponse } from 'next/server';
import { loadChartManifest } from '@/lib/charts/load-chart-data';
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
    if (manifest) return LOCAL_PREVIEW_USER;
  }
  return null;
}

export async function GET() {
  try {
    const user = await resolveChartUser();
    if (!user) {
      return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
    }

    const manifest = await loadChartManifest();
    if (!manifest) {
      return NextResponse.json({ error: 'Chart manifest not available.' }, { status: 404 });
    }

    return NextResponse.json({ user, manifest });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load chart manifest.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
