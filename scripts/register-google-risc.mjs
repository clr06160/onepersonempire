/**
 * One-time: register Cross-Account Protection (RISC) event stream.
 *
 * Requires:
 *   GOOGLE_RISC_SERVICE_ACCOUNT_JSON = full SA JSON with roles/riscconfigs.admin
 *   GOOGLE_OAUTH_CLIENT_ID = web client ID used for Sign in with Google
 * Optional:
 *   RISC_RECEIVER_URL = https://onepersonempire.web.app/api/scanner/auth/risc
 */
import { createSign } from 'crypto';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

/** Google RISC expects a self-signed SA JWT (not an OAuth access token). */
function riscBearerToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://risc.googleapis.com/google.identity.risc.v1beta.RiscManagementService',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key, 'base64url');
  return `${unsigned}.${signature}`;
}

async function main() {
  const sa = JSON.parse(required('GOOGLE_RISC_SERVICE_ACCOUNT_JSON'));
  const clientId = required('GOOGLE_OAUTH_CLIENT_ID');
  const receiver =
    process.env.RISC_RECEIVER_URL?.trim() || 'https://onepersonempire.web.app/api/scanner/auth/risc';

  const token = riscBearerToken(sa);
  const streamBody = {
    delivery: {
      delivery_method: 'https://schemas.openid.net/secevent/risc/delivery-method/push',
      url: receiver,
    },
    events_requested: [
      'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
      'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
      'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
      'https://schemas.openid.net/secevent/risc/event-type/account-enabled',
      'https://schemas.openid.net/secevent/risc/event-type/account-purged',
      'https://schemas.openid.net/secevent/risc/event-type/credential-change-required',
    ],
  };

  const update = await fetch('https://risc.googleapis.com/v1beta/stream:update', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(streamBody),
  });
  const updateText = await update.text();
  if (!update.ok) {
    throw new Error(`stream:update failed (${update.status}): ${updateText}`);
  }

  console.log('RISC stream registered.');
  console.log('Receiver:', receiver);
  console.log('OAuth client ID (aud):', clientId);
  console.log('Response:', updateText || '(empty)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
