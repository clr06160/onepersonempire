import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadScannerValuationsData } from '@/lib/scanner-valuations-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  if (user.role !== 'developer') {
    return NextResponse.json(
      { error: 'Valuations are restricted to the owner account.', restricted: true },
      { status: 403 },
    );
  }

  try {
    const data = await loadScannerValuationsData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load scanner valuations.');
    return NextResponse.json({ user, data: { connected: false, message, rows: [] } });
  }
}
