import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { generateAndStoreDeskBrief, loadLatestDeskBrief } from '@/lib/scanner-desk-brief';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';
export const maxDuration = 180;

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadLatestDeskBrief();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load morning note.');
    return NextResponse.json({
      user,
      data: {
        connected: false,
        asOf: new Date().toISOString().slice(0, 10),
        generatedAt: new Date().toISOString(),
        headline: '',
        sections: [],
        bullets: [],
        watch: [],
        disclaimer: 'Dream Tree desk note — not investment advice.',
        message,
      },
    });
  }
}

export async function POST() {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Developer access required.' }, { status: 403 });
  }

  try {
    const data = await generateAndStoreDeskBrief();
    // Best-effort postcard fanout for Watchers (never blocks the note save).
    try {
      const { dispatchMorningPostcards } = await import('@/lib/scanner-morning-postcard');
      void dispatchMorningPostcards();
    } catch (postcardError) {
      console.warn('[desk-brief] postcard dispatch skipped', postcardError);
    }
    return NextResponse.json({ user, data, regenerated: true });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not generate morning note.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
