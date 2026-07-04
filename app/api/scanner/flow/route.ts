import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import {
  loadFlowTicker,
  loadScannerFlowData,
  toViewerFlowPayload,
  type FlowPayload,
  type FlowTickerPayload,
} from '@/lib/scanner-flow-data';

export const runtime = 'nodejs';

function stripForViewer(row: FlowTickerPayload) {
  return toViewerFlowPayload(row.id, row);
}

export async function GET(request: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();
  const isDeveloper = user.role === 'developer';

  try {
    if (ticker) {
      const row = await loadFlowTicker(ticker);
      if (!row) {
        return NextResponse.json(
          { user, connected: false, message: `No flow data for ${ticker}.` },
          { status: 404 },
        );
      }
      if (isDeveloper) {
        return NextResponse.json({ user, connected: true, ticker: row });
      }
      return NextResponse.json(stripForViewer(row));
    }

    const data: FlowPayload = await loadScannerFlowData();
    if (isDeveloper) {
      return NextResponse.json({ user, data });
    }

    const summaries: Record<string, ReturnType<typeof stripForViewer>> = {};
    for (const [symbol, row] of Object.entries(data.tickers || {})) {
      summaries[symbol] = stripForViewer(row);
    }
    return NextResponse.json({
      user,
      connected: data.connected,
      generatedAt: data.generatedAt,
      tickers: summaries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load flow data.';
    return NextResponse.json({ user, connected: false, message, tickers: {} });
  }
}
