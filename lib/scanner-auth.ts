import crypto from 'crypto';
import { cookies } from 'next/headers';
import { getAdminFirestore } from '@/lib/firebase-admin';

export type ScannerRole = 'viewer' | 'developer';

export type ScannerUser = {
  email: string;
  name?: string;
  picture?: string;
  role: ScannerRole;
};

const COOKIE_NAME = 'scanner_session';
const SESSION_DAYS = 14;

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

function configuredGoogleClientId() {
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
  const payload = base64Url(JSON.stringify({ ...user, expiresAt }));
  return `${payload}.${signPayload(payload)}`;
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
    };
  } catch {
    return null;
  }
}

export async function verifyGoogleCredential(credential: string) {
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
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
  };

  if (data.aud !== clientId) {
    throw new Error('Google sign-in token was issued for a different app.');
  }
  if (!data.email || String(data.email_verified) !== 'true') {
    throw new Error('Google account email is not verified.');
  }

  return {
    email: normalizeEmail(data.email),
    name: data.name,
    picture: data.picture,
  };
}

export async function getScannerRole(email: string): Promise<ScannerRole | null> {
  const normalized = normalizeEmail(email);
  const developers = parseEmailList(process.env.SCANNER_DEVELOPER_EMAILS);
  const viewers = parseEmailList(process.env.SCANNER_ALLOWED_EMAILS);

  if (developers.has(normalized)) return 'developer';
  if (viewers.has(normalized)) return 'viewer';

  try {
    const snapshot = await getAdminFirestore().collection('scannerUsers').doc(normalized).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() || {};
    if (data.active === false) return null;
    return data.role === 'developer' ? 'developer' : 'viewer';
  } catch {
    return null;
  }
}

export async function createScannerSession(user: ScannerUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, makeCookieValue(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearScannerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getScannerSession(): Promise<ScannerUser | null> {
  const cookieStore = await cookies();
  return verifyCookieValue(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireScannerSession(role: ScannerRole = 'viewer') {
  const user = await getScannerSession();
  if (!user) return null;
  if (role === 'developer' && user.role !== 'developer') return null;
  return user;
}
