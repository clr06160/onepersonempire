import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type RawBearRow = {
  ticker: string;
  rank?: number;
  accelScore?: number;
  roc20Pct?: number;
  accel20Pct?: number;
  close?: number;
};

export type RawBearUniverse = {
  key?: string;
  universe?: string;
  label?: string;
  top?: string[];
  rows?: RawBearRow[];
  eligibleCount?: number;
  negativeCount?: number;
};

export type RawBearForwardUniverse = {
  key?: string;
  label?: string;
  openCount?: number;
  currentTickers?: string[];
  lastAsOf?: string;
  openAvgReturnPct?: number | null;
  summary?: {
    periodCount?: number;
    avgPeriodReturnPct?: number | null;
    totalReturnPct?: number | null;
    hitRatePct?: number | null;
  };
  recentPeriods?: Array<{
    from?: string;
    to?: string;
    returnPct?: number | null;
    tickers?: string[];
    count?: number;
    universeCount?: number;
  }>;
};

export type RawBearForwardTest = {
  asOf?: string;
  updatedAt?: string;
  method?: string;
  universes?: RawBearForwardUniverse[];
};

export type RawBearPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  topN?: number;
  method?: string[];
  universes?: RawBearUniverse[];
  top?: string[];
  forwardTest?: RawBearForwardTest;
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_RAW_BEAR_OBJECT || 'scanner/raw_bear_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<RawBearPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as RawBearPayload;
}

async function loadFromFile(): Promise<RawBearPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates('SCANNER_RAW_BEAR_JSON_PATH', 'raw_bear_dashboard.json')) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as RawBearPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadRawBearDashboard(): Promise<RawBearPayload> {
  const local = await loadFromFile().catch(() => null);
  if (local) return local;

  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    // fall through
  }

  return {
    connected: false,
    message: 'Raw Bear scan has not been built yet. Run build_raw_bear_scanner.py on your PC.',
    universes: [],
  };
}
