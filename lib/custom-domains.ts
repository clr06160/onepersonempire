import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  hostVariants,
  isAppHost,
  isValidDomain,
  normalizeDomain,
  normalizeHost,
} from '@/lib/custom-domain-host';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  getFirebaseHostingCustomDomain,
  type HostingProvisionResult,
  provisionFirebaseHostingCustomDomain,
  removeFirebaseHostingCustomDomain,
} from '@/lib/firebase-hosting';
import { getPublishedSite } from '@/lib/published-sites';

export type CustomDomainRecord = {
  slug: string;
  apexDomain: string;
  createdAt: string;
  updatedAt: string;
  hostingStatus?: 'active' | 'pending' | 'provisioning' | 'error' | 'skipped';
  hostingMessage?: string;
  hostingHostState?: string;
  hostingOwnershipState?: string;
};

export {
  getDomainCnameTarget,
  isAppHost,
  isValidDomain,
  normalizeDomain,
  normalizeHost,
} from '@/lib/custom-domain-host';

const CUSTOM_DOMAINS_COLLECTION = 'customDomains';
const CUSTOM_DOMAINS_DIR = path.join(process.cwd(), 'data', 'custom-domains');

function isFirestorePublishingEnabled() {
  return process.env.PUBLISH_STORAGE === 'firestore';
}

function localDomainPath(host: string) {
  return path.join(CUSTOM_DOMAINS_DIR, `${host}.json`);
}

async function readLocalDomain(host: string) {
  try {
    return JSON.parse(await readFile(localDomainPath(host), 'utf8')) as CustomDomainRecord;
  } catch {
    return null;
  }
}

async function writeLocalDomain(host: string, record: CustomDomainRecord) {
  await mkdir(CUSTOM_DOMAINS_DIR, { recursive: true });
  await writeFile(localDomainPath(host), JSON.stringify(record), 'utf8');
}

async function deleteLocalDomain(host: string) {
  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(localDomainPath(host));
  } catch {
    // Ignore missing files.
  }
}

export async function getSlugForHost(host: string) {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost || isAppHost(normalizedHost)) return null;

  if (isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const snapshot = await db.collection(CUSTOM_DOMAINS_COLLECTION).doc(normalizedHost).get();
    if (!snapshot.exists) return null;
    const slug = snapshot.data()?.slug;
    return typeof slug === 'string' ? slug : null;
  }

  const record = await readLocalDomain(normalizedHost);
  return record?.slug || null;
}

export async function getCustomDomainForSlug(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  if (isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const snapshot = await db
      .collection(CUSTOM_DOMAINS_COLLECTION)
      .where('slug', '==', normalizedSlug)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const data = snapshot.docs[0]?.data();
    const apexDomain = data?.apexDomain;
    return typeof apexDomain === 'string' ? apexDomain : null;
  }

  try {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(CUSTOM_DOMAINS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const record = await readLocalDomain(file.replace(/\.json$/, ''));
      if (record?.slug === normalizedSlug) return record.apexDomain;
    }
  } catch {
    return null;
  }

  return null;
}

export async function getCustomDomainDetailsForSlug(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  const apexDomain = await getCustomDomainForSlug(normalizedSlug);
  if (!apexDomain) return null;

  let hosting: HostingProvisionResult | null = null;
  try {
    hosting = await getFirebaseHostingCustomDomain(apexDomain);
  } catch {
    hosting = null;
  }

  if (!hosting && isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const snapshot = await db.collection(CUSTOM_DOMAINS_COLLECTION).doc(apexDomain).get();
    const data = snapshot.data();
    if (data?.hostingStatus) {
      hosting = {
        status: data.hostingStatus,
        hostState: typeof data.hostingHostState === 'string' ? data.hostingHostState : undefined,
        ownershipState: typeof data.hostingOwnershipState === 'string' ? data.hostingOwnershipState : undefined,
        dnsRecords: [],
        message: typeof data.hostingMessage === 'string' ? data.hostingMessage : undefined,
      };
    }
  }

  return {
    apexDomain,
    hosting,
  };
}

export async function saveCustomDomain(input: { slug: string; domain: string }) {
  const slug = input.slug.trim().toLowerCase();
  const apexDomain = normalizeDomain(input.domain);

  if (!slug) throw new Error('Publish the site first.');
  if (!isValidDomain(apexDomain)) throw new Error('Enter a valid domain like joespainting.com.');

  const publishedSite = await getPublishedSite(slug);
  if (!publishedSite) throw new Error('Publish the site before connecting a custom domain.');

  const previousApex = await getCustomDomainForSlug(slug);
  if (previousApex && previousApex !== apexDomain) {
    try {
      await removeFirebaseHostingCustomDomain(previousApex);
    } catch {
      // Keep going even if Firebase cleanup fails.
    }
  }

  const hosting = await provisionFirebaseHostingCustomDomain(apexDomain);
  const now = new Date().toISOString();
  const record: CustomDomainRecord = {
    slug,
    apexDomain,
    createdAt: now,
    updatedAt: now,
    hostingStatus: hosting.status,
    hostingMessage: hosting.message,
    hostingHostState: hosting.hostState,
    hostingOwnershipState: hosting.ownershipState,
  };

  if (isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const variants = hostVariants(apexDomain);

    for (const host of variants) {
      const existing = await db.collection(CUSTOM_DOMAINS_COLLECTION).doc(host).get();
      const existingSlug = existing.data()?.slug;
      if (existing.exists && existingSlug && existingSlug !== slug) {
        throw new Error(`${host} is already connected to another site.`);
      }
    }

    const previous = await db
      .collection(CUSTOM_DOMAINS_COLLECTION)
      .where('slug', '==', slug)
      .get();

    await Promise.all(previous.docs.map((doc) => doc.ref.delete()));

    await Promise.all(
      variants.map(async (host) => {
        const existing = await db.collection(CUSTOM_DOMAINS_COLLECTION).doc(host).get();
        await db.collection(CUSTOM_DOMAINS_COLLECTION).doc(host).set({
          slug,
          apexDomain,
          host,
          createdAt: existing.data()?.createdAt || now,
          updatedAt: now,
          ...(host === apexDomain
            ? {
              hostingStatus: record.hostingStatus || null,
              hostingMessage: record.hostingMessage || null,
              hostingHostState: record.hostingHostState || null,
              hostingOwnershipState: record.hostingOwnershipState || null,
            }
            : {}),
        });
      }),
    );

    return { record, hosting };
  }

  const variants = hostVariants(apexDomain);
  for (const host of variants) {
    const existing = await readLocalDomain(host);
    if (existing && existing.slug !== slug) {
      throw new Error(`${host} is already connected to another site.`);
    }
  }

  const previousApexLocal = await getCustomDomainForSlug(slug);
  if (previousApexLocal && previousApexLocal !== apexDomain) {
    for (const host of hostVariants(previousApexLocal)) {
      await deleteLocalDomain(host);
    }
  }

  await Promise.all(variants.map((host) => writeLocalDomain(host, record)));
  return { record, hosting };
}
