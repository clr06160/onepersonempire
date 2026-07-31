import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadScannerCatalystsData } from '@/lib/scanner-catalysts-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  // Catalyst evidence includes licensed news snippets. Keep it owner-only.
  if (user.role !== 'developer') {
    return NextResponse.json(
      { error: 'Catalysts are restricted to the owner account.', restricted: true },
      { status: 403 },
    );
  }

  try {
    const data = await loadScannerCatalystsData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load scanner catalysts.');
    return NextResponse.json({ user, data: { connected: false, message, rows: [], themes: [] } });
  }
}
