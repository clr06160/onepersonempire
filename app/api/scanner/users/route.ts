import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { listScannerUsersDirectory, setScannerUserActive } from '@/lib/scanner-users-admin';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Developer: all known accounts + who has signed in. */
export async function GET() {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  try {
    const lists = await listScannerUsersDirectory();
    return NextResponse.json({ user, all: lists.all, signedIn: lists.signedIn });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load users.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Developer: disable or re-enable a user (soft delete). */
export async function PATCH(req: Request) {
  const session = await requireScannerSession('developer');
  if (!session) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { email?: string; active?: boolean };
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    if (!email || typeof body.active !== 'boolean') {
      return NextResponse.json({ error: 'email and active (boolean) are required.' }, { status: 400 });
    }
    if (email === session.email && body.active === false) {
      return NextResponse.json({ error: 'You cannot disable your own developer account.' }, { status: 400 });
    }

    const updated = await setScannerUserActive(email, body.active);
    if (!updated) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }
    return NextResponse.json({ user: updated });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not update user.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
