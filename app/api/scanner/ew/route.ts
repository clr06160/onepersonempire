import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadEwOverlay } from '@/lib/scanner-ew-overlay';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const overlay = await loadEwOverlay();
    return NextResponse.json({ user, overlay });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load EW overlay.');
    return NextResponse.json({
      user,
      overlay: { labelsBySystem: {}, message },
    });
  }
}
