import { NextResponse } from 'next/server';
import {
  buildScannerSessionCookie,
  consumeGoogleSignInTicket,
  getScannerRole,
  isGoogleIdentityRevoked,
  verifyGoogleCredential,
} from '@/lib/scanner-auth';
import { ensureOpenSignupViewer, touchScannerUserLogin } from '@/lib/scanner-users-admin';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { credential?: string; ticket?: string };
    if (!body.credential) {
      return NextResponse.json({ error: 'Missing Google sign-in credential.' }, { status: 400 });
    }

    const expectedNonce = consumeGoogleSignInTicket(body.ticket);
    const googleUser = await verifyGoogleCredential(body.credential, expectedNonce);

    if (await isGoogleIdentityRevoked(googleUser)) {
      return NextResponse.json(
        { error: 'This Google account has been locked for scanner access. Sign in again later or contact support.' },
        { status: 403 },
      );
    }

    // Open signup: any verified Google account gets viewer access unless disabled.
    let role = await getScannerRole(googleUser.email);
    if (!role) {
      role = await ensureOpenSignupViewer(googleUser);
    } else {
      try {
        await touchScannerUserLogin({ ...googleUser, role });
      } catch {
        // Non-fatal: session still works if Firestore touch fails.
      }
    }
    if (!role) {
      return NextResponse.json(
        { error: 'This Google account has been disabled for scanner access.' },
        { status: 403 },
      );
    }

    const user = { ...googleUser, role };
    const sessionCookie = buildScannerSessionCookie(user);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
    return response;
  } catch (error) {
    const message = toScannerUserMessage(error, 'Login failed.');
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
