import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadCupHandleData } from '@/lib/scanner-cup-handle-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadCupHandleData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load the Cup with Handle scan.');
    return NextResponse.json({ user, data: { connected: false, message, universes: [], recentBreakouts: [] } });
  }
}
