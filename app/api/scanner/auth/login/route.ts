import { NextResponse } from 'next/server';
import { createScannerSession, getScannerRole, verifyGoogleCredential } from '@/lib/scanner-auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { credential?: string };
    if (!body.credential) {
      return NextResponse.json({ error: 'Missing Google sign-in credential.' }, { status: 400 });
    }

    const googleUser = await verifyGoogleCredential(body.credential);
    const role = await getScannerRole(googleUser.email);
    if (!role) {
      return NextResponse.json({ error: 'This Google account is not approved for scanner access.' }, { status: 403 });
    }

    const user = { ...googleUser, role };
    await createScannerSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
