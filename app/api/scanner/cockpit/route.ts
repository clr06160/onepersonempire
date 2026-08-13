import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { buildCockpitPayload } from '@/lib/scanner-cockpit';
import { loadCockpitForward } from '@/lib/scanner-cockpit-forward';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const [data, forward] = await Promise.all([buildCockpitPayload(), loadCockpitForward()]);
    return NextResponse.json({ user, data, forward });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load cockpit.');
    return NextResponse.json({
      user,
      data: {
        connected: false,
        message,
        generatedAt: new Date().toISOString(),
        gauges: [],
        book: { names: [], grossExposurePct: 0, cashPct: 100, missionBrief: [] },
      },
      forward: { connected: false, message },
    });
  }
}
