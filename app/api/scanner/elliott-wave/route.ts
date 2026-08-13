import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadElliottWaveDashboard } from '@/lib/scanner-elliott-wave-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadElliottWaveDashboard();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load Elliott Wave dashboard.');
    return NextResponse.json({ user, data: { connected: false, message, markets: [] } });
  }
}
