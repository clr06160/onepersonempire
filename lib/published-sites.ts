import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { getAdminFirestore, getAdminStorageBucket } from '@/lib/firebase-admin';

export type PublishedSite = {
  slug: string;
  html: string;
  idea?: string;
  safetyReview?: {
    status: 'approved' | 'blocked' | 'needs_review';
    reason: string;
    checkedAt: string;
  };
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
  chunkCount?: number;
};

const PUBLISHED_DIR = path.join(process.cwd(), 'data', 'published-sites');
const PUBLISHED_COLLECTION = 'publishedSites';
const HTML_CHUNK_SIZE = 900_000;

function isFirestorePublishingEnabled() {
  return process.env.PUBLISH_STORAGE === 'firestore';
}

function isCloudAssetPublishingEnabled() {
  return Boolean(process.env.PUBLISHED_ASSETS_BUCKET);
}

function assertPublishStorageConfiguredForRuntime() {
  if (
    process.env.NODE_ENV === 'production'
    && !isFirestorePublishingEnabled()
    && process.env.ALLOW_LOCAL_PUBLISH_STORAGE !== 'true'
  ) {
    throw new Error('Publishing needs PUBLISH_STORAGE=firestore in production. Set ALLOW_LOCAL_PUBLISH_STORAGE=true only for a temporary tester build.');
  }
}

export function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function sitePath(slug: string) {
  return path.join(PUBLISHED_DIR, `${slug}.json`);
}

function splitHtml(html: string) {
  const chunks: string[] = [];
  for (let index = 0; index < html.length; index += HTML_CHUNK_SIZE) {
    chunks.push(html.slice(index, index + HTML_CHUNK_SIZE));
  }
  return chunks;
}

function chunkId(index: number) {
  return index.toString().padStart(4, '0');
}

function imageExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/x-png') return 'png';
  return mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
}

async function replaceDataUrlImages(slug: string, html: string) {
  if (!isCloudAssetPublishingEnabled()) return { html, assetCount: 0 };

  const bucket = getAdminStorageBucket();
  let output = html;
  const matches = [...html.matchAll(/\ssrc=(["'])data:(image\/[a-zA-Z0-9.+-]+);base64,([^"']+)\1/gi)];
  let assetCount = 0;

  for (const match of matches) {
    const [fullMatch, quote, mimeType, base64] = match;
    const buffer = Buffer.from(base64, 'base64');
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 24);
    const extension = imageExtension(mimeType);
    const fileName = `${hash}.${extension}`;
    const storagePath = `published-sites/${slug}/${fileName}`;

    await bucket.file(storagePath).save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });

    output = output.replace(fullMatch, ` src=${quote}/published-assets/${slug}/${fileName}${quote}`);
    assetCount += 1;
  }

  return { html: output, assetCount };
}

export async function publishSite(input: {
  slug: string;
  html: string;
  idea?: string;
  safetyReview?: PublishedSite['safetyReview'];
}) {
  assertPublishStorageConfiguredForRuntime();
  const slug = normalizeSlug(input.slug);
  if (!slug) throw new Error('Enter a simple site URL name, like coffee-subscription.');
  if (!input.html || input.html.length < 100) throw new Error('Generate a site before publishing.');

  const now = new Date().toISOString();
  const { html: publishHtml, assetCount } = await replaceDataUrlImages(slug, input.html);

  if (isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const ref = db.collection(PUBLISHED_COLLECTION).doc(slug);
    const existing = await ref.get();
    const chunks = splitHtml(publishHtml);
    const site: PublishedSite = {
      slug,
      idea: input.idea,
      safetyReview: input.safetyReview,
      createdAt: existing.exists ? existing.data()?.createdAt || now : now,
      updatedAt: now,
      html: '',
      assetCount,
      chunkCount: chunks.length,
    };

    const oldChunks = await ref.collection('htmlChunks').get();
    await Promise.all(oldChunks.docs.map((doc) => doc.ref.delete()));
    await Promise.all(
      chunks.map((chunk, index) =>
        ref.collection('htmlChunks').doc(chunkId(index)).set({ html: chunk }),
      ),
    );
    await ref.set({
      slug,
      idea: input.idea || null,
      safetyReview: input.safetyReview || null,
      createdAt: site.createdAt,
      updatedAt: now,
      chunkCount: chunks.length,
      assetCount,
      storage: 'chunks',
    });
    return site;
  }

  await mkdir(PUBLISHED_DIR, { recursive: true });

  let createdAt = now;
  try {
    const existing = JSON.parse(await readFile(sitePath(slug), 'utf8')) as PublishedSite;
    createdAt = existing.createdAt || now;
  } catch {
    // New site.
  }

  const site: PublishedSite = {
    slug,
    html: publishHtml,
    idea: input.idea,
    safetyReview: input.safetyReview,
    createdAt,
    updatedAt: now,
    assetCount,
    chunkCount: splitHtml(publishHtml).length,
  };

  await writeFile(sitePath(slug), JSON.stringify(site), 'utf8');
  return site;
}

export async function getPublishedSite(slug: string) {
  assertPublishStorageConfiguredForRuntime();
  const normalized = normalizeSlug(slug);
  if (!normalized) return null;

  if (isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const ref = db
      .collection(PUBLISHED_COLLECTION)
      .doc(normalized);
    const snapshot = await ref.get();

    if (!snapshot.exists) return null;

    const data = snapshot.data();
    const chunkCount = Number(data?.chunkCount || 0);
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, index) =>
        ref.collection('htmlChunks').doc(chunkId(index)).get(),
      ),
    );
    const html = chunks.map((chunk) => chunk.data()?.html || '').join('');

    return {
      slug: normalized,
      html,
      idea: typeof data?.idea === 'string' ? data.idea : undefined,
      createdAt: typeof data?.createdAt === 'string' ? data.createdAt : '',
      updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : '',
    };
  }

  try {
    return JSON.parse(await readFile(sitePath(normalized), 'utf8')) as PublishedSite;
  } catch {
    return null;
  }
}

export async function updatePublishedSiteHtml(input: {
  slug: string;
  html: string;
}) {
  assertPublishStorageConfiguredForRuntime();
  const normalized = normalizeSlug(input.slug);
  if (!normalized) throw new Error('Enter a valid site name.');
  if (!input.html || input.html.length < 100) throw new Error('Updated site HTML is empty.');

  const existing = await getPublishedSite(normalized);
  if (!existing) throw new Error(`No published site found for "${normalized}".`);

  const now = new Date().toISOString();

  if (isFirestorePublishingEnabled()) {
    const db = getAdminFirestore();
    const ref = db.collection(PUBLISHED_COLLECTION).doc(normalized);
    const chunks = splitHtml(input.html);
    const oldChunks = await ref.collection('htmlChunks').get();

    await Promise.all(oldChunks.docs.map((doc) => doc.ref.delete()));
    await Promise.all(
      chunks.map((chunk, index) =>
        ref.collection('htmlChunks').doc(chunkId(index)).set({ html: chunk }),
      ),
    );
    await ref.set({
      slug: normalized,
      idea: existing.idea || null,
      createdAt: existing.createdAt || now,
      updatedAt: now,
      chunkCount: chunks.length,
      assetCount: existing.assetCount || 0,
      storage: 'chunks',
    });

    return {
      ...existing,
      html: input.html,
      updatedAt: now,
      chunkCount: chunks.length,
    };
  }

  const updated: PublishedSite = {
    ...existing,
    html: input.html,
    updatedAt: now,
    chunkCount: splitHtml(input.html).length,
  };

  await mkdir(PUBLISHED_DIR, { recursive: true });
  await writeFile(sitePath(normalized), JSON.stringify(updated), 'utf8');

  return updated;
}

export async function getPublishedAsset(slug: string, fileName: string) {
  const normalizedSlug = normalizeSlug(slug);
  const normalizedFile = fileName.match(/^[a-z0-9][a-z0-9.-]{1,96}\.(png|jpg|jpeg|webp|gif|svg)$/i)?.[0];
  if (!normalizedSlug || !normalizedFile || !isCloudAssetPublishingEnabled()) return null;

  const file = getAdminStorageBucket().file(`published-sites/${normalizedSlug}/${normalizedFile}`);
  const [exists] = await file.exists();
  if (!exists) return null;

  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();

  return {
    buffer,
    contentType: metadata.contentType || 'application/octet-stream',
    cacheControl: metadata.cacheControl || 'public, max-age=31536000, immutable',
  };
}
