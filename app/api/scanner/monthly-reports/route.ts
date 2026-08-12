import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadMonthlyReports } from '@/lib/scanner-monthly-reports';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadMonthlyReports();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load monthly reports.');
    return NextResponse.json(
      {
        user,
        connected: false,
        message,
        data: {
          connected: false,
          message,
          thresholdPct: 10,
          signal: 'day3',
          leadersTickerCount: 0,
          months: [],
        },
      },
      { status: 500 },
    );
  }
}
