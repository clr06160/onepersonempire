import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadIpoShortDashboard } from '@/lib/scanner-ipo-short-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadIpoShortDashboard();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load Shorting IPOs.');
    return NextResponse.json(
      {
        user,
        connected: false,
        message,
        data: {
          connected: false,
          message,
          headline: {},
          byYear6m: [],
          stopSweep6m: [],
          operatingRules: [],
          bottomLine: [],
        },
      },
      { status: 500 },
    );
  }
}
