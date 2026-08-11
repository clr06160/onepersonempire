import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadScannerData } from '@/lib/scanner-data';
import { loadPickContextPayload } from '@/lib/scanner-pick-context';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const [data, pickContext] = await Promise.all([loadScannerData(), loadPickContextPayload()]);
    return NextResponse.json({ user, data, pickContext });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load scanner data.');
    return NextResponse.json(
      {
        user,
        data: { connected: false, message, systems: [] },
        pickContext: { byTicker: {}, lenses: [] },
        error: message,
      },
      { status: 500 },
    );
  }
}
