export function normalizeHost(host: string | null | undefined) {
  if (!host) return '';
  return host.split(':')[0].toLowerCase().replace(/\.$/, '');
}

export function normalizeDomain(value: string) {
  let domain = value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.split('/')[0] || '';
  domain = domain.split(':')[0] || '';
  domain = domain.replace(/^www\./, '');
  return domain.replace(/[^a-z0-9.-]/g, '').replace(/^-+|-+$/g, '');
}

export function isValidDomain(domain: string) {
  if (!domain || domain.length > 253) return false;
  if (!domain.includes('.')) return false;
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}

export function getAppHosts() {
  const configured = (process.env.APP_HOSTS || '')
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean);

  const defaults = [
    'localhost',
    '127.0.0.1',
    'onepersonempire.web.app',
    'www.onepersonempire.web.app',
    'onepersonempire.firebaseapp.com',
    'www.onepersonempire.firebaseapp.com',
  ];

  const baseUrlHost = normalizeHost(
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '').split('/')[0],
  );
  if (baseUrlHost) defaults.push(baseUrlHost);

  const publishHost = normalizeHost(
    process.env.PUBLISH_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '').split('/')[0],
  );
  if (publishHost) defaults.push(publishHost);

  return new Set([...defaults, ...configured]);
}

export function isAppHost(host: string) {
  const normalized = normalizeHost(host);
  if (!normalized) return true;
  if (getAppHosts().has(normalized)) return true;
  if (normalized.endsWith('.run.app')) return true;
  return false;
}

export function getDomainCnameTarget() {
  return (
    process.env.NEXT_PUBLIC_DOMAIN_CNAME_TARGET
    || normalizeHost(process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '').split('/')[0])
    || 'onepersonempire.web.app'
  );
}

function hostVariants(apexDomain: string) {
  return [apexDomain, `www.${apexDomain}`];
}

export { hostVariants };
