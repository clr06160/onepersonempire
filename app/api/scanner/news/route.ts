import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadScannerNewsData } from '@/lib/scanner-news-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // News is pulled from a licensed provider that we may not redistribute.
  // Only the owner/developer account may load it; other signed-in users are blocked.
  if (user.role !== 'developer') {
    return NextResponse.json(
      { error: 'News is restricted to the owner account.', restricted: true },
      { status: 403 },
    );
  }

  try {
    const data = await loadScannerNewsData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load scanner news data.');
    return NextResponse.json({ user, data: { connected: false, message, feed: [], byTicker: {}, market: [] } });
  }
}
