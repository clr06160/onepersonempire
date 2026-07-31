import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type CockpitForwardTrade = {
  date?: string;
  type?: string;
  added?: string[];
  removed?: string[];
  holdings?: string[];
  exposurePct?: number;
  reason?: string;
  monthReturnPct?: number;
};

export type CockpitForwardPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  mode?: string;
  cashMode?: boolean;
  monthKey?: string;
  monthReturnPct?: number;
  monthlyBreakerPct?: number;
  exposurePct?: number;
  holdings?: string[];
  weights?: Array<{ ticker: string; weightPct: number }>;
  brief?: string[];
  metrics?: {
    days?: number;
    totalReturnPct?: number;
    maxDrawdownPct?: number;
    equity?: number;
  };
  trades?: CockpitForwardTrade[];
  equitySeries?: Array<{ date: string; equity: number; exposurePct?: number; cashMode?: boolean }>;
  note?: string;
  message?: string;
  source?: string;
};

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function objectName() {
  return process.env.SCANNER_COCKPIT_FORWARD_GCS_OBJECT || 'scanner/cockpit_forward_dashboard.json';
}

async function fromGcs(): Promise<CockpitForwardPayload | null> {
  const bucket = bucketName();
  if (!bucket) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(bucket).file(objectName()).download();
  return { ...(JSON.parse(content.toString('utf8')) as CockpitForwardPayload), source: 'gcs' };
}

async function fromFile(): Promise<CockpitForwardPayload | null> {
  for (const path of resolveScannerJsonCandidates(
    'SCANNER_COCKPIT_FORWARD_JSON_PATH',
    'cockpit_forward_dashboard.json',
  )) {
    try {
      const raw = await readFile(path, 'utf8');
      return { ...(JSON.parse(raw) as CockpitForwardPayload), source: 'file' };
    } catch {
      continue;
    }
  }
  return null;
}

export async function loadCockpitForward(): Promise<CockpitForwardPayload> {
  try {
    const cloud = await fromGcs();
    if (cloud) return cloud;
  } catch {
    // fall through
  }
  const file = await fromFile();
  if (file) return file;
  return {
    connected: false,
    message: 'Cockpit forward paper not uploaded yet. Run scanner_cockpit_crew.py --upload on your PC.',
  };
}
