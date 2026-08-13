import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadScannerAgents, normalizeAgentLeaderboard } from '@/lib/scanner-agents';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadScannerAgents();
    const normalized = {
      ...data,
      leaderboard: normalizeAgentLeaderboard(data.leaderboard),
    };
    return NextResponse.json(
      { user, data: normalized },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load agent tournament.');
    return NextResponse.json({
      user,
      data: { connected: false, message, leaderboard: [], agents: {} },
    });
  }
}
