import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { configuredGoogleClientId, recordGoogleIdentityRevocation } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RiscConfig = {
  issuer?: string;
  jwks_uri?: string;
};

type Jwk = {
  kid?: string;
  kty?: string;
  n?: string;
  e?: string;
  alg?: string;
};

function base64UrlToBuffer(value: string) {
  return Buffer.from(value, 'base64url');
}

function decodeJwtPart(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function loadRiscConfig(): Promise<RiscConfig> {
  const response = await fetch('https://accounts.google.com/.well-known/risc-configuration', {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Could not load RISC configuration.');
  return (await response.json()) as RiscConfig;
}

async function loadJwks(jwksUri: string): Promise<Jwk[]> {
  const response = await fetch(jwksUri, { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load Google JWKS.');
  const data = (await response.json()) as { keys?: Jwk[] };
  return data.keys || [];
}

function jwkToPem(jwk: Jwk) {
  if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
    throw new Error('Unsupported JWK.');
  }
  const keyObject = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });
  return keyObject.export({ type: 'spki', format: 'pem' });
}

async function verifySecurityEventToken(token: string) {
  const clientId = configuredGoogleClientId();
  if (!clientId) throw new Error('Missing Google OAuth client ID.');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed security event token.');
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeJwtPart(headerB64);
  const payload = decodeJwtPart(payloadB64);
  const kid = typeof header.kid === 'string' ? header.kid : '';

  const risc = await loadRiscConfig();
  const issuer = risc.issuer || 'https://accounts.google.com';
  const jwksUri = risc.jwks_uri || 'https://www.googleapis.com/oauth2/v3/certs';
  const keys = await loadJwks(jwksUri);
  const jwk = keys.find((key) => key.kid === kid);
  if (!jwk) throw new Error('Unknown signing key for security event token.');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const ok = verifier.verify(jwkToPem(jwk), base64UrlToBuffer(signatureB64));
  if (!ok) throw new Error('Security event token signature invalid.');

  if (payload.iss !== issuer && payload.iss !== 'accounts.google.com') {
    throw new Error('Security event token issuer mismatch.');
  }

  const aud = payload.aud;
  const audOk = aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
  if (!audOk) throw new Error('Security event token audience mismatch.');

  return payload;
}

function subjectFromEvent(events: Record<string, unknown>) {
  for (const value of Object.values(events)) {
    if (!value || typeof value !== 'object') continue;
    const subject = (value as { subject?: { sub?: string; email?: string } }).subject;
    if (subject?.sub || subject?.email) {
      return { googleSub: subject.sub, email: subject.email };
    }
  }
  return {};
}

export async function POST(req: Request) {
  try {
    const raw = (await req.text()).trim();
    if (!raw) {
      return NextResponse.json({ error: 'Empty RISC payload.' }, { status: 400 });
    }

    // Google may POST the SET as raw JWT or JSON { token: "..." }.
    let token = raw;
    if (raw.startsWith('{')) {
      const parsed = JSON.parse(raw) as { token?: string };
      if (!parsed.token) {
        return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
      }
      token = parsed.token;
    }

    const payload = await verifySecurityEventToken(token);
    const events = (payload.events || {}) as Record<string, unknown>;
    const eventTypes = Object.keys(events);
    const subject = subjectFromEvent(events);

    const actionable = eventTypes.some((type) =>
      /sessions-revoked|tokens-revoked|account-disabled|account-purged|credential-change-required/i.test(type),
    );

    if (actionable) {
      await recordGoogleIdentityRevocation({
        email: subject.email,
        googleSub: subject.googleSub,
        eventType: eventTypes.join(','),
        eventId: typeof payload.jti === 'string' ? payload.jti : undefined,
        reason: 'Google Cross-Account Protection (RISC)',
      });
    }

    return NextResponse.json({ ok: true, handled: eventTypes });
  } catch (error) {
    const message = toScannerUserMessage(error, 'RISC event rejected.');
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
