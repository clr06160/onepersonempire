import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadProbabilitiesPayload } from '@/lib/scanner-probabilities-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadProbabilitiesPayload();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load probabilities.');
    return NextResponse.json({
      user,
      data: {
        connected: false,
        generatedAt: new Date().toISOString(),
        sourceCount: 0,
        missingSources: [],
        note: '',
        cards: [],
        message,
      },
    });
  }
}
