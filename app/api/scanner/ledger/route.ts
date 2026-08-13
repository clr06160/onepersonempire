import { NextResponse } from 'next/server';

import { analyzeForwardLedger } from '@/lib/scanner-forward-ledger-analysis';
import { loadForwardLedgerTrades } from '@/lib/scanner-forward-ledger-ingest';
import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const monthKey = url.searchParams.get('month') || undefined;
    const systemId = url.searchParams.get('system') || undefined;
    const forceSync = url.searchParams.get('sync') === '1';

    const { trades, sync } = await loadForwardLedgerTrades({
      monthKey,
      systemId,
      forceSync,
    });
    const analysis = analyzeForwardLedger(trades, { monthKey: monthKey || null });

    return NextResponse.json({
      user,
      data: {
        connected: true,
        trades,
        analysis,
        sync,
      },
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load forward-test ledger.');
    return NextResponse.json(
      {
        user,
        error: message,
        data: {
          connected: false,
          trades: [],
          analysis: null,
          message,
        },
      },
      { status: 500 },
    );
  }
}

/** Force a sync from all forward-test dashboards into the ledger. */
export async function POST() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const { trades, sync } = await loadForwardLedgerTrades({ forceSync: true });
    const analysis = analyzeForwardLedger(trades);
    return NextResponse.json({
      user,
      data: {
        connected: true,
        trades,
        analysis,
        sync,
      },
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not sync forward-test ledger.');
    return NextResponse.json({ user, error: message }, { status: 500 });
  }
}
