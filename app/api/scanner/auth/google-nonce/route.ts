import { NextResponse } from 'next/server';
import { issueGoogleSignInNonce } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const issued = issueGoogleSignInNonce();
    return NextResponse.json(
      { nonce: issued.nonce, ticket: issued.ticket, expiresAt: issued.expiresAt },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not start Google sign-in.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
