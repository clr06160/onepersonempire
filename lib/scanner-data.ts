import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ScannerPayload = {
  connected?: boolean;
  generatedAt?: string;
  message?: string;
  source?: string;
  systems?: unknown[];
};

function normalizeScannerPayload(parsed: unknown): ScannerPayload {
  if (Array.isArray(parsed)) {
    return { connected: true, systems: parsed };
  }
  if (parsed && typeof parsed === 'object') {
    return parsed as ScannerPayload;
  }
  return { connected: false, message: 'Scanner data was empty.', systems: [] };
}

function scannerBucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function scannerObjectName() {
  return process.env.SCANNER_RESULTS_GCS_OBJECT || 'scanner/stock_scanner_dashboard.json';
}

async function loadScannerDataFromGcs(): Promise<ScannerPayload | null> {
  const bucketName = scannerBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage()
    .bucket(bucketName)
    .file(scannerObjectName())
    .download();

  return normalizeScannerPayload(JSON.parse(content.toString('utf8')));
}

async function loadScannerDataFromFiles(): Promise<ScannerPayload | null> {
  const jsonPath = process.env.SCANNER_RESULTS_JSON_PATH;
  const htmlPath = process.env.SCANNER_RESULTS_HTML_PATH;
  if (!jsonPath && !htmlPath) return null;

  if (jsonPath) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return normalizeScannerPayload(JSON.parse(raw));
    } catch (error) {
      if (!htmlPath) throw error;
    }
  }

  const html = await readFile(htmlPath as string, 'utf8');
  const match = html.match(/const systems = (\[[\s\S]*?\]);\s*const select =/);
  if (!match) {
    throw new Error('Could not find scanner systems in dashboard HTML.');
  }

  return {
    connected: true,
    source: 'html-fallback',
    systems: JSON.parse(match[1]),
  };
}

async function loadScannerDataUncached(): Promise<ScannerPayload> {
  try {
    const cloudData = await loadScannerDataFromGcs();
    if (cloudData) {
      return { ...cloudData, source: cloudData.source || 'gcs' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load scanner data from cloud storage.';
    const fileData = await loadScannerDataFromFiles().catch(() => null);
    if (fileData) return fileData;
    return { connected: false, message, systems: [] };
  }

  const fileData = await loadScannerDataFromFiles();
  if (fileData) return fileData;

  return {
    connected: false,
    message:
      'Scanner login is working. Waiting for the first upload from your PC scanner refresh job.',
    systems: [],
  };
}

// Short-lived in-process cache so repeat page loads don't re-download the
// dashboard JSON from Cloud Storage on every request. The data refreshes once
// per day, so a brief TTL is safe and removes the per-load GCS round-trip.
const SCANNER_CACHE_TTL_MS = 60_000;
let scannerCache: { data: ScannerPayload; expires: number } | null = null;

export async function loadScannerData(): Promise<ScannerPayload> {
  if (scannerCache && scannerCache.expires > Date.now()) {
    return scannerCache.data;
  }

  const data = await loadScannerDataUncached();

  // Only cache successful loads; never cache an error/empty fallback so a
  // transient failure can't get pinned for the full TTL.
  if (data && data.connected !== false) {
    scannerCache = { data, expires: Date.now() + SCANNER_CACHE_TTL_MS };
  }

  return data;
}
