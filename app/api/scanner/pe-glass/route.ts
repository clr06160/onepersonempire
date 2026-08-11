import { NextResponse } from 'next/server';

import { loadPeGlassDashboard } from '@/lib/scanner-pe-glass-data';
import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadPeGlassDashboard();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load Earnings Glass.');
    return NextResponse.json({ user, data: { connected: false, message, rows: [] } });
  }
}
