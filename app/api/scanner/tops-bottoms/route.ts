import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadTopsBottomsData } from '@/lib/scanner-tops-bottoms-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadTopsBottomsData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load tops & bottoms study.');
    return NextResponse.json({
      user,
      data: { connected: false, message, events: [], framework: [], method: [] },
    });
  }
}
