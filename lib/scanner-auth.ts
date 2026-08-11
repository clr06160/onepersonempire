import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebase-admin';

export type ScannerRole = 'viewer' | 'developer';

export type ScannerUser = {
  email: string;
  name?: string;
  picture?: string;
  role: ScannerRole;
  /** Google subject (`sub`) when available — used for RISC revocation. */
  googleSub?: string;
};

// Firebase Hosting only forwards a cookie named __session to Cloud Run backends.
export const SCANNER_SESSION_COOKIE = '__session';
const SESSION_DAYS = 14;
const NONCE_TTL_MS = 10 * 60 * 1000;
const REVOCATIONS_COLLECTION = 'scannerAuthRevocations';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function scannerSecret() {
  const secret = process.env.SCANNER_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('Missing SCANNER_AUTH_SECRET.');
  }
  return secret;
}

export function configuredGoogleClientId() {
  return process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
}

function parseEmailList(value: string | undefined) {
  return new Set(
    (value || '')
      .split(',')
      .map((item) => normalizeEmail(item))
      .filter(Boolean),
  );
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function signPayload(payload: string) {
  return crypto.createHmac('sha256', scannerSecret()).update(payload).digest('base64url');
}

function makeCookieValue(user: ScannerUser) {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = base64Url(
    JSON.stringify({
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      googleSub: user.googleSub,
      expiresAt,
    }),
  );
  return `${payload}.${signPayload(payload)}`;
}

export function scannerSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function buildScannerSessionCookie(user: ScannerUser) {
  return {
    name: SCANNER_SESSION_COOKIE,
    value: makeCookieValue(user),
    options: scannerSessionCookieOptions(),
  };
}

function verifyCookieValue(value: string | undefined): ScannerUser | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return null;

  const expected = signPayload(payload);
  const given = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (given.length !== expectedBuffer.length || !crypto.timingSafeEqual(given, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.email || !parsed.role || Date.now() > Number(parsed.expiresAt || 0)) return null;
    return {
      email: normalizeEmail(parsed.email),
      name: parsed.name,
      picture: parsed.picture,
      role: parsed.role === 'developer' ? 'developer' : 'viewer',
      googleSub: typeof parsed.googleSub === 'string' ? parsed.googleSub : undefined,
    };
  } catch {
    return null;
  }
}

/** Signed ticket so nonce works even when Firebase Hosting only forwards `__session`. */
export function issueGoogleSignInNonce() {
  const nonce = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + NONCE_TTL_MS;
  const payload = base64Url(JSON.stringify({ nonce, expiresAt }));
  const ticket = `${payload}.${signPayload(payload)}`;
  return { nonce, ticket, expiresAt };
}

export function consumeGoogleSignInTicket(ticket: string | undefined): string {
  if (!ticket) {
    throw new Error('Missing Google sign-in nonce ticket.');
  }
  const [payload, signature] = ticket.split('.');
  if (!payload || !signature) {
    throw new Error('Invalid Google sign-in nonce ticket.');
  }
  const expected = signPayload(payload);
  const given = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (given.length !== expectedBuffer.length || !crypto.timingSafeEqual(given, expectedBuffer)) {
    throw new Error('Invalid Google sign-in nonce ticket.');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    nonce?: string;
    expiresAt?: number;
  };
  if (!parsed.nonce || Date.now() > Number(parsed.expiresAt || 0)) {
    throw new Error('Google sign-in nonce expired. Refresh and try again.');
  }
  return parsed.nonce;
}

export async function verifyGoogleCredential(credential: string, expectedNonce?: string) {
  const clientId = configuredGoogleClientId();
  if (!clientId) {
    throw new Error('Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID.');
  }

  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`, {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Google sign-in token could not be verified.');
  }

  const data = (await response.json()) as {
    aud?: string;
    sub?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
    nonce?: string;
  };

  if (data.aud !== clientId) {
    throw new Error('Google sign-in token was issued for a different app.');
  }
  if (!data.email || String(data.email_verified) !== 'true') {
    throw new Error('Google account email is not verified.');
  }
  if (expectedNonce) {
    if (!data.nonce || data.nonce !== expectedNonce) {
      throw new Error('Google sign-in nonce mismatch.');
    }
  }

  return {
    email: normalizeEmail(data.email),
    name: data.name,
    picture: data.picture,
    googleSub: data.sub || undefined,
  };
}

export async function isGoogleIdentityRevoked(identity: {
  email?: string;
  googleSub?: string;
}): Promise<boolean> {
  const email = identity.email ? normalizeEmail(identity.email) : '';
  const sub = identity.googleSub?.trim() || '';
  if (!email && !sub) return false;

  try {
    const db = getAdminFirestore();
    const refs = [
      ...(sub ? [db.collection(REVOCATIONS_COLLECTION).doc(`sub:${sub}`)] : []),
      ...(email ? [db.collection(REVOCATIONS_COLLECTION).doc(`email:${email}`)] : []),
    ];
    const snaps = await Promise.all(refs.map((ref) => ref.get()));
    return snaps.some((snap) => {
      if (!snap.exists) return false;
      const data = snap.data() || {};
      if (data.active === false) return false;
      return true;
    });
  } catch {
    return false;
  }
}

export async function recordGoogleIdentityRevocation(args: {
  email?: string;
  googleSub?: string;
  eventType: string;
  eventId?: string;
  reason?: string;
}) {
  const email = args.email ? normalizeEmail(args.email) : '';
  const sub = args.googleSub?.trim() || '';
  if (!email && !sub) return;

  const db = getAdminFirestore();
  const now = new Date().toISOString();
  const payload = {
    active: true,
    eventType: args.eventType,
    eventId: args.eventId || null,
    reason: args.reason || null,
    email: email || null,
    googleSub: sub || null,
    updatedAt: now,
  };

  const writes: Array<Promise<unknown>> = [];
  if (sub) {
    writes.push(
      db.collection(REVOCATIONS_COLLECTION).doc(`sub:${sub}`).set(
        { ...payload, key: `sub:${sub}` },
        { merge: true },
      ),
    );
  }
  if (email) {
    writes.push(
      db.collection(REVOCATIONS_COLLECTION).doc(`email:${email}`).set(
        { ...payload, key: `email:${email}` },
        { merge: true },
      ),
    );
  }
  await Promise.all(writes);
}

export async function getScannerRole(email: string): Promise<ScannerRole | null> {
  const normalized = normalizeEmail(email);
  const developers = parseEmailList(process.env.SCANNER_DEVELOPER_EMAILS);
  const viewers = parseEmailList(process.env.SCANNER_ALLOWED_EMAILS);

  try {
    const snapshot = await getAdminFirestore().collection('scannerUsers').doc(normalized).get();
    if (snapshot.exists) {
      const data = snapshot.data() || {};
      // Admin disable always wins — even over env allowlists.
      if (data.active === false) return null;
      if (data.role === 'developer' || developers.has(normalized)) return 'developer';
      return 'viewer';
    }
  } catch {
    // Fall through to env lists if Firestore is unavailable.
  }

  if (developers.has(normalized)) return 'developer';
  if (viewers.has(normalized)) return 'viewer';
  return null;
}

export async function createScannerSession(user: ScannerUser) {
  const cookie = buildScannerSessionCookie(user);
  const cookieStore = await cookies();
  cookieStore.set(cookie.name, cookie.value, cookie.options);
}

export async function clearScannerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SCANNER_SESSION_COOKIE);
}

export async function getScannerSession(): Promise<ScannerUser | null> {
  const cookieStore = await cookies();
  const user = verifyCookieValue(cookieStore.get(SCANNER_SESSION_COOKIE)?.value);
  if (!user) return null;
  if (await isGoogleIdentityRevoked(user)) return null;
  return user;
}

export async function requireScannerSession(role: ScannerRole = 'viewer') {
  const user = await getScannerSession();
  if (!user) return null;
  if (role === 'developer' && user.role !== 'developer') return null;
  return user;
}
