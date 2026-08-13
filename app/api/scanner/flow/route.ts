import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';
import { loadFlowTicker, loadScannerFlowData } from '@/lib/scanner-flow-data';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  if (user.role !== 'developer') {
    return NextResponse.json(
      { error: 'Flow data is restricted to the owner account.', restricted: true },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const ticker = (searchParams.get('ticker') || '').trim().toUpperCase();

  try {
    if (ticker) {
      const row = await loadFlowTicker(ticker);
      if (!row) {
        return NextResponse.json(
          { user, connected: false, message: `No flow data for ${ticker}.` },
          { status: 404 },
        );
      }
      return NextResponse.json({ user, connected: true, ticker: row });
    }

    const data = await loadScannerFlowData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load flow data.');
    return NextResponse.json({ user, connected: false, message, tickers: {} });
  }
}
