import crypto from 'crypto';

import { getAdminStorageBucket } from '@/lib/firebase-admin';

const JOURNAL_CHART_PREFIX = 'scanner/journal';
const MAX_CHART_BYTES = 3 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function ownerKey(ownerEmail: string) {
  return crypto.createHash('sha256').update(ownerEmail.trim().toLowerCase()).digest('hex').slice(0, 24);
}

function extensionForType(contentType: string) {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function chartObjectPath(ownerEmail: string, entryId: string, contentType: string) {
  const ext = extensionForType(contentType);
  return `${JOURNAL_CHART_PREFIX}/${ownerKey(ownerEmail)}/${entryId}.${ext}`;
}

export function validateChartUpload(contentType: string, size: number) {
  if (!ALLOWED_TYPES.has(contentType)) {
    return { error: 'Chart must be a PNG, JPEG, or WebP screenshot.' };
  }
  if (size <= 0) return { error: 'Chart file is empty.' };
  if (size > MAX_CHART_BYTES) return { error: 'Chart must be 3 MB or smaller.' };
  return { ok: true as const };
}

export async function saveJournalChart(
  ownerEmail: string,
  entryId: string,
  buffer: Buffer,
  contentType: string,
) {
  const bucket = getAdminStorageBucket();
  const objectPath = chartObjectPath(ownerEmail, entryId, contentType);
  await bucket.file(objectPath).save(buffer, {
    metadata: {
      contentType,
      cacheControl: 'private, max-age=0, no-store',
    },
  });
  return objectPath;
}

async function listChartPaths(ownerEmail: string, entryId: string) {
  const bucket = getAdminStorageBucket();
  const prefix = `${JOURNAL_CHART_PREFIX}/${ownerKey(ownerEmail)}/${entryId}.`;
  const [files] = await bucket.getFiles({ prefix });
  return files;
}

export async function readJournalChart(ownerEmail: string, entryId: string) {
  const files = await listChartPaths(ownerEmail, entryId);
  const file = files[0];
  if (!file) return null;
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || 'image/png');
  return { buffer, contentType };
}

export async function deleteJournalChart(ownerEmail: string, entryId: string) {
  const files = await listChartPaths(ownerEmail, entryId);
  await Promise.all(files.map((file) => file.delete().catch(() => undefined)));
}
