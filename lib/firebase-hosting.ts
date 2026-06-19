import { getApps } from 'firebase-admin/app';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

const HOSTING_API = 'https://firebasehosting.googleapis.com/v1beta1';

type FirebaseDnsRecord = {
  domainName?: string;
  type?: string;
  rdata?: string;
  requiredAction?: string;
};

type FirebaseDnsRecordSet = {
  domainName?: string;
  records?: FirebaseDnsRecord[];
};

type FirebaseCustomDomain = {
  name?: string;
  hostState?: string;
  ownershipState?: string;
  requiredDnsUpdates?: {
    desired?: FirebaseDnsRecordSet[];
  };
  issues?: Array<{ message?: string }>;
  reconciling?: boolean;
};

export type HostingDnsRecord = {
  type: string;
  host: string;
  value: string;
  action?: string;
};

export type HostingProvisionResult = {
  status: 'active' | 'pending' | 'provisioning' | 'error' | 'skipped';
  hostState?: string;
  ownershipState?: string;
  dnsRecords: HostingDnsRecord[];
  message?: string;
};

function hostingProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'onepersonempire';
}

function hostingSiteId() {
  return process.env.FIREBASE_HOSTING_SITE || 'onepersonempire';
}

function hostingParentPath() {
  return `projects/${hostingProjectId()}/sites/${hostingSiteId()}`;
}

function isAutoProvisionEnabled() {
  return process.env.AUTO_PROVISION_FIREBASE_CUSTOM_DOMAINS !== 'false';
}

async function getHostingAccessToken() {
  initializeFirebaseAdmin();
  const app = getApps()[0];
  const credential = app?.options.credential;
  if (!credential) {
    throw new Error('Firebase credentials are not configured.');
  }

  const token = await credential.getAccessToken();
  if (!token.access_token) {
    throw new Error('Could not get Firebase Hosting access token.');
  }

  return token.access_token;
}

async function hostingRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const accessToken = await getHostingAccessToken();
  const response = await fetch(`${HOSTING_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const text = await response.text();
  let data = {} as T & { error?: { message?: string } };
  if (text) {
    try {
      data = JSON.parse(text) as T & { error?: { message?: string } };
    } catch {
      return {
        ok: false,
        status: response.status,
        message: text.slice(0, 240) || `Firebase Hosting returned a non-JSON response (${response.status}).`,
      };
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data.error?.message || `Firebase Hosting request failed (${response.status}).`,
    };
  }

  return { ok: true, data };
}

function dnsHostFromDomainName(domainName: string) {
  const trimmed = domainName.replace(/\.$/, '');
  const parts = trimmed.split('.');
  if (parts.length <= 2) return '@';
  return parts.slice(0, -2).join('.') || '@';
}

function parseDnsRecords(customDomain: FirebaseCustomDomain): HostingDnsRecord[] {
  const desired = customDomain.requiredDnsUpdates?.desired || [];
  const records: HostingDnsRecord[] = [];

  for (const set of desired) {
    for (const record of set.records || []) {
      if (!record.type || !record.rdata) continue;
      const host = dnsHostFromDomainName(record.domainName || set.domainName || '');
      records.push({
        type: record.type,
        host,
        value: record.rdata,
        action: record.requiredAction,
      });
    }
  }

  return records;
}

function mapCustomDomainStatus(customDomain: FirebaseCustomDomain): HostingProvisionResult {
  const dnsRecords = parseDnsRecords(customDomain);
  const hostState = customDomain.hostState || '';
  const ownershipState = customDomain.ownershipState || '';
  const issueMessage = customDomain.issues?.map((issue) => issue.message).filter(Boolean).join(' ');

  if (hostState === 'HOST_ACTIVE' && ownershipState === 'OWNERSHIP_ACTIVE') {
    return {
      status: 'active',
      hostState,
      ownershipState,
      dnsRecords,
      message: 'Your domain is connected and serving this site.',
    };
  }

  if (hostState === 'HOST_UNHOSTED' || ownershipState === 'OWNERSHIP_MISSING') {
    return {
      status: 'pending',
      hostState,
      ownershipState,
      dnsRecords,
      message: 'Domain saved. Give GoDaddy the DNS records below, then wait for them to update.',
    };
  }

  if (customDomain.reconciling) {
    return {
      status: 'provisioning',
      hostState,
      ownershipState,
      dnsRecords,
      message: 'Firebase is setting up SSL for your domain. This can take up to a few hours after DNS is correct.',
    };
  }

  return {
    status: 'provisioning',
    hostState,
    ownershipState,
    dnsRecords,
    message: issueMessage || 'Firebase is finishing domain setup.',
  };
}

export async function getFirebaseHostingCustomDomain(apexDomain: string): Promise<HostingProvisionResult | null> {
  if (!isAutoProvisionEnabled()) return null;

  const result = await hostingRequest<FirebaseCustomDomain>(
    `/${hostingParentPath()}/customDomains/${encodeURIComponent(apexDomain)}`,
  );

  if (!result.ok) {
    if (result.status === 404) return null;
    throw new Error(result.message);
  }

  return mapCustomDomainStatus(result.data);
}

export async function provisionFirebaseHostingCustomDomain(apexDomain: string): Promise<HostingProvisionResult> {
  if (!isAutoProvisionEnabled()) {
    return {
      status: 'skipped',
      dnsRecords: [],
      message: 'Automatic Firebase Hosting setup is disabled.',
    };
  }

  try {
    const existing = await getFirebaseHostingCustomDomain(apexDomain);
    if (existing) return existing;

    const createResult = await hostingRequest<FirebaseCustomDomain>(
      `/${hostingParentPath()}/customDomains?customDomainId=${encodeURIComponent(apexDomain)}`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
    );

    if (!createResult.ok) {
      if (createResult.message.toLowerCase().includes('already exists')) {
        const existingAfterConflict = await getFirebaseHostingCustomDomain(apexDomain);
        if (existingAfterConflict) return existingAfterConflict;
      }
      return {
        status: 'error',
        dnsRecords: [],
        message: createResult.message,
      };
    }

    const created = await getFirebaseHostingCustomDomain(apexDomain);
    return created || {
      status: 'provisioning',
      dnsRecords: [],
      message: 'Domain registered with Firebase Hosting. Give GoDaddy the DNS records below.',
    };
  } catch (error) {
    return {
      status: 'error',
      dnsRecords: [],
      message: error instanceof Error ? error.message : 'Firebase Hosting setup failed.',
    };
  }
}

export async function removeFirebaseHostingCustomDomain(apexDomain: string) {
  if (!isAutoProvisionEnabled() || !apexDomain) return;

  const result = await hostingRequest<Record<string, never>>(
    `/${hostingParentPath()}/customDomains/${encodeURIComponent(apexDomain)}`,
    { method: 'DELETE' },
  );

  if (!result.ok && result.status !== 404) {
    throw new Error(result.message);
  }
}
