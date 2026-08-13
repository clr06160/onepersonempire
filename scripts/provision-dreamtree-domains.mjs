/**
 * Provision dreamtreestocks.com (+ www) on Firebase Hosting site onepersonempire.
 *
 * Usage (from repo root, with Hosting Admin on your gcloud account):
 *   node scripts/provision-dreamtree-domains.mjs
 *
 * Prints DNS rows to paste into GoDaddy.
 */
const PROJECT = process.env.FIREBASE_PROJECT_ID || 'onepersonempire';
const SITE = process.env.FIREBASE_HOSTING_SITE || 'onepersonempire';
const DOMAINS = ['dreamtreestocks.com', 'www.dreamtreestocks.com'];
const API = 'https://firebasehosting.googleapis.com/v1beta1';

async function accessToken() {
  if (process.env.FIREBASE_ACCESS_TOKEN?.trim()) {
    return process.env.FIREBASE_ACCESS_TOKEN.trim();
  }
  const { execSync } = await import('node:child_process');
  return execSync('gcloud auth print-access-token', { encoding: 'utf8', shell: true }).trim();
}

async function hosting(path, init = {}) {
  const token = await accessToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-goog-user-project': PROJECT,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

function flattenDns(domain) {
  const desired = domain?.requiredDnsUpdates?.desired || [];
  const rows = [];
  for (const set of desired) {
    for (const rec of set.records || []) {
      rows.push({
        type: rec.type,
        host: rec.domainName || set.domainName,
        value: rec.rdata,
        action: rec.requiredAction,
      });
    }
  }
  return rows;
}

async function ensureDomain(fqdn) {
  const parent = `/projects/${PROJECT}/sites/${SITE}`;
  const get = await hosting(`${parent}/customDomains/${encodeURIComponent(fqdn)}`);
  if (get.ok) {
    return { created: false, domain: get.data };
  }
  if (get.status !== 404) {
    throw new Error(`${fqdn} get failed (${get.status}): ${JSON.stringify(get.data)}`);
  }
  const create = await hosting(
    `${parent}/customDomains?customDomainId=${encodeURIComponent(fqdn)}`,
    { method: 'POST', body: '{}' },
  );
  if (!create.ok && !String(create.data?.error?.message || '').toLowerCase().includes('already')) {
    throw new Error(`${fqdn} create failed (${create.status}): ${JSON.stringify(create.data)}`);
  }
  const again = await hosting(`${parent}/customDomains/${encodeURIComponent(fqdn)}`);
  return { created: true, domain: again.data };
}

async function main() {
  const out = [];
  for (const fqdn of DOMAINS) {
    const { created, domain } = await ensureDomain(fqdn);
    out.push({
      fqdn,
      created,
      hostState: domain?.hostState,
      ownershipState: domain?.ownershipState,
      dns: flattenDns(domain),
      issues: domain?.issues || [],
    });
  }
  console.log(JSON.stringify({ project: PROJECT, site: SITE, domains: out }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
