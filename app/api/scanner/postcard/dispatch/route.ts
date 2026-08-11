import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

import { requireScannerSession } from '@/lib/scanner-auth';
import { dispatchMorningPostcards } from '@/lib/scanner-morning-postcard';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

function dispatchSecret() {
  return (
    process.env.SCANNER_ALERTS_DISPATCH_SECRET?.trim() ||
    process.env.SCANNER_AUTH_SECRET?.trim() ||
    ''
  );
}

function authorizedBySecret(req: Request) {
  const expected = dispatchSecret();
  if (!expected) return false;
  const header = req.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const alt = req.headers.get('x-scanner-alerts-secret')?.trim() || '';
  const given = bearer || alt;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { test?: boolean };
  const sessionUser = await requireScannerSession();
  const secretOk = authorizedBySecret(req);

  if (!sessionUser && !secretOk) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  try {
    if (body.test) {
      if (!sessionUser) {
        return NextResponse.json({ error: 'Sign in to send a test postcard.' }, { status: 401 });
      }
      const result = await dispatchMorningPostcards({ onlyEmail: sessionUser.email });
      return NextResponse.json({ user: sessionUser, result });
    }

    const result = await dispatchMorningPostcards();
    return NextResponse.json({ result });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not send morning postcards.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
