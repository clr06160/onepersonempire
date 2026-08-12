import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadBracketDashboard } from '@/lib/scanner-bracket-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadBracketDashboard();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load Horizontal Bracket.');
    return NextResponse.json(
      {
        user,
        connected: false,
        message,
        data: { connected: false, message, buyCandidates: [], sellCandidates: [], rows: [] },
      },
      { status: 500 },
    );
  }
}
