import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import type { FedWatchPayload } from '@/lib/fedwatch-utils';

function fedwatchObjectName() {
  return process.env.SCANNER_RESULTS_GCS_FEDWATCH_OBJECT || 'scanner/cme_fedwatch_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<FedWatchPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(fedwatchObjectName()).download();
  return JSON.parse(content.toString('utf8')) as FedWatchPayload;
}

async function loadFromFile(): Promise<FedWatchPayload | null> {
  const jsonPath = process.env.SCANNER_FEDWATCH_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as FedWatchPayload;
}

export async function loadFedWatchData(): Promise<FedWatchPayload> {
  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    const file = await loadFromFile().catch(() => null);
    if (file) return file;
  }

  const file = await loadFromFile().catch(() => null);
  if (file) return file;

  return {
    connected: false,
    message: 'Fed rate odds not uploaded yet. Run the daily refresh on your PC, then upload.',
    meetings: [],
  };
}
