import { NextResponse } from 'next/server';
import { SCANNER_SESSION_COOKIE, scannerSessionCookieOptions } from '@/lib/scanner-auth';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SCANNER_SESSION_COOKIE, '', { ...scannerSessionCookieOptions(), maxAge: 0 });
  return response;
}
