import { NextResponse } from 'next/server';

import { analyzeForwardLedger } from '@/lib/scanner-forward-ledger-analysis';
import { loadForwardLedgerTrades } from '@/lib/scanner-forward-ledger-ingest';
import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

/**
 * Anytime analysis endpoint for the proprietary forward-test ledger.
 * GET /api/scanner/ledger/analysis?month=YYYY-MM&sync=1
 */
export async function GET(request: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const monthKey = url.searchParams.get('month') || undefined;
    const forceSync = url.searchParams.get('sync') === '1';

    const { trades, sync } = await loadForwardLedgerTrades({
      monthKey: forceSync ? undefined : monthKey,
      forceSync,
    });
    // If we force-synced all, re-filter for month analysis
    const scoped = monthKey ? trades.filter((t) => t.monthKey === monthKey) : trades;
    const analysis = analyzeForwardLedger(forceSync ? trades : scoped, { monthKey: monthKey || null });

    return NextResponse.json({
      user,
      data: {
        connected: true,
        analysis,
        tradeCount: (monthKey ? scoped : trades).length,
        sync,
      },
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not analyze forward-test ledger.');
    return NextResponse.json({ user, error: message }, { status: 500 });
  }
}
