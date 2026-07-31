import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export type LearnedPainOverlay = {
  title?: string;
  badge?: string;
  summary?: string;
  thresholds?: string[];
  stacking?: string[];
  scope?: string[];
  howToUse?: string[];
  live?: {
    badge?: string;
    label?: string;
    scalePct?: number;
    painProbPct?: string;
    reason?: string;
    asOf?: string;
  };
};

export type ScannerInstructionSystem = {
  id: string;
  label: string;
  role?: string;
  summary?: string;
  rebalance?: string;
  sizing?: string;
  exposure?: string;
  howToUse?: string[];
  caveats?: string[];
  method?: string[];
  note?: string;
  stats?: Record<string, string>;
  powertrendNote?: string;
  regimeNote?: string;
  overlayModuleNote?: string;
};

export type ScannerInstructionsPayload = {
  connected?: boolean;
  generatedAt?: string;
  message?: string;
  source?: string;
  globalRegime?: Record<string, unknown>;
  learnedPainOverlay?: LearnedPainOverlay;
  systems?: ScannerInstructionSystem[];
};

function scannerBucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function instructionsObjectName() {
  return process.env.SCANNER_INSTRUCTIONS_GCS_OBJECT || 'scanner/stock_scanner_instructions.json';
}

async function loadInstructionsFromGcs(): Promise<ScannerInstructionsPayload | null> {
  const bucketName = scannerBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage()
    .bucket(bucketName)
    .file(instructionsObjectName())
    .download();

  const parsed = JSON.parse(content.toString('utf8'));
  if (!parsed || typeof parsed !== 'object') {
    return { connected: false, message: 'Instructions payload was empty.', systems: [] };
  }
  return { ...(parsed as ScannerInstructionsPayload), source: 'gcs' };
}

async function loadInstructionsFromFile(): Promise<ScannerInstructionsPayload | null> {
  const jsonPath = process.env.SCANNER_INSTRUCTIONS_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  const parsed = JSON.parse(raw);
  return { ...(parsed as ScannerInstructionsPayload), source: 'file' };
}

export async function loadScannerInstructions(): Promise<ScannerInstructionsPayload> {
  try {
    const cloudData = await loadInstructionsFromGcs();
    if (cloudData) return cloudData;
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load instructions from cloud storage.');
    const fileData = await loadInstructionsFromFile().catch(() => null);
    if (fileData) return fileData;
    return { connected: false, message, systems: [] };
  }

  const fileData = await loadInstructionsFromFile();
  if (fileData) return fileData;

  return {
    connected: false,
    message: 'Instructions not uploaded yet. Run the stocks scanner refresh and upload instructions JSON.',
    systems: [],
  };
}
