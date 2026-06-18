import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type EwOverlayPayload = {
  generatedAt?: string;
  sourceGeneratedAt?: string;
  asOf?: string;
  labelsBySystem?: Record<string, Record<string, string>>;
  message?: string;
  source?: string;
};

function normalizeEwOverlay(parsed: unknown): EwOverlayPayload {
  if (parsed && typeof parsed === 'object') {
    return parsed as EwOverlayPayload;
  }
  return { labelsBySystem: {} };
}

function ewBucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function ewObjectName() {
  return process.env.SCANNER_RESULTS_GCS_EW_OBJECT || 'scanner/stock_scanner_ew_overlay.json';
}

async function loadEwOverlayFromGcs(): Promise<EwOverlayPayload | null> {
  const bucketName = ewBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(bucketName).file(ewObjectName()).download();
  return normalizeEwOverlay(JSON.parse(content.toString('utf8')));
}

async function loadEwOverlayFromFile(): Promise<EwOverlayPayload | null> {
  const jsonPath = process.env.SCANNER_EW_JSON_PATH;
  if (!jsonPath) return null;

  const raw = await readFile(jsonPath, 'utf8');
  return normalizeEwOverlay(JSON.parse(raw));
}

export async function loadEwOverlay(): Promise<EwOverlayPayload> {
  try {
    const cloudData = await loadEwOverlayFromGcs();
    if (cloudData) {
      return { ...cloudData, source: cloudData.source || 'gcs' };
    }
  } catch {
    const fileData = await loadEwOverlayFromFile().catch(() => null);
    if (fileData) return fileData;
  }

  const fileData = await loadEwOverlayFromFile().catch(() => null);
  if (fileData) return fileData;

  return {
    labelsBySystem: {},
    message: 'EW overlay not uploaded yet. Run elliott_wave_overlay.py after the scanner refresh.',
  };
}
