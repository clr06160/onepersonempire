import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type FmpScreenerRow = {
  rank: number;
  ticker: string;
  company?: string;
  sector?: string;
  salesGrowthPct?: number | null;
  epsGrowthPct?: number | null;
  netIncomeGrowthPct?: number | null;
  fcfGrowthPct?: number | null;
  rule40?: number | null;
  grossMarginExpansionPct?: number | null;
  combinedScore?: number | null;
  latestRevenueB?: number | null;
  marketCapB?: number | null;
  immediateReactionPct?: number | null;
  threeDayReactionPct?: number | null;
  earningsReactionScore?: number | null;
  latestEarningsDate?: string | null;
};

export type FmpUniverseDataset = {
  label?: string;
  tickerCount?: number;
  rows?: FmpScreenerRow[];
};

export type FmpScreenerPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  topN?: number;
  defaultUniverse?: string;
  defaultSort?: string;
  universe?: string;
  universeLabel?: string;
  sortKey?: string;
  sortLabel?: string;
  tickerCount?: number;
  universeOptions?: Array<{ key: string; label: string }>;
  sortOptions?: Array<{ key: string; label: string; ascending?: boolean }>;
  universes?: Record<string, FmpUniverseDataset>;
  rows?: FmpScreenerRow[];
  note?: string;
  message?: string;
};

function fmpObjectName() {
  return process.env.SCANNER_RESULTS_GCS_FMP_OBJECT || 'scanner/fmp_growth_screener.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<FmpScreenerPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(fmpObjectName()).download();
  return JSON.parse(content.toString('utf8')) as FmpScreenerPayload;
}

async function loadFromFile(): Promise<FmpScreenerPayload | null> {
  const jsonPath = process.env.SCANNER_FMP_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as FmpScreenerPayload;
}

export async function loadFmpScreenerData(): Promise<FmpScreenerPayload> {
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
    message: 'FMP screener not uploaded yet. Run scanners/fmp_growth_screener.py on your PC, then upload.',
    rows: [],
  };
}
