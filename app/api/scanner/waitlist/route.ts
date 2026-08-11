import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';
import {
  listWaitlist,
  scoreWaitlistTrust,
  upsertWaitlistInterest,
  validateWaitlistInput,
} from '@/lib/scanner-waitlist';

export const runtime = 'nodejs';

/** Public interest form — no login required. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const honeypotFilled =
    (typeof body.company === 'string' && body.company.trim().length > 0) ||
    (typeof body.website === 'string' && body.website.trim().length > 0);

  const validated = validateWaitlistInput(body);
  if ('error' in validated) {
    // Still look successful to honeypot bots that fail validation oddly.
    if (honeypotFilled) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const dwellMs = Number(body.dwellMs);
  const trust = scoreWaitlistTrust({
    email: validated.value.email,
    message: validated.value.message,
    honeypotFilled,
    dwellMs: Number.isFinite(dwellMs) ? dwellMs : 0,
    userAgent: req.headers.get('user-agent') || '',
  });

  try {
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0];
    await upsertWaitlistInterest({
      email: validated.value.email,
      message: validated.value.message,
      sourceHost: host,
      trust,
    });
    return NextResponse.json({
      ok: true,
      message: 'Thanks — we got your note. We’ll reach out if there’s a fit.',
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not save your interest.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Developer inbox for waitlist leads. */
export async function GET() {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  try {
    const entries = await listWaitlist();
    return NextResponse.json({ user, entries });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load waitlist.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
