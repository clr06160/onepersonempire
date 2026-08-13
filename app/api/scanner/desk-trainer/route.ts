import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadDeskTrainerPack } from '@/lib/scanner-desk-trainer-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadDeskTrainerPack();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load Desk Trainer.');
    return NextResponse.json(
      { user, connected: false, message, data: { connected: false, message, sessions: [] } },
      { status: 500 },
    );
  }
}
