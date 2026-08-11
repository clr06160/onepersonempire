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

function liveObjectName() {
  return process.env.SCANNER_RESULTS_GCS_FMP_OBJECT || 'scanner/fmp_growth_screener.json';
}

function edgarObjectName() {
  return process.env.SCANNER_RESULTS_GCS_EDGAR_OBJECT || 'scanner/edgar_growth_screener.json';
}

function gcsObjectCandidates(): string[] {
  const live = liveObjectName();
  const edgar = edgarObjectName();
  return live === edgar ? [live] : [live, edgar];
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function hasScreenerRows(payload: FmpScreenerPayload | null | undefined): boolean {
  if (!payload) return false;
  if (payload.connected === false) return false;
  if (Array.isArray(payload.rows) && payload.rows.length > 0) return true;
  const universes = payload.universes;
  if (!universes) return false;
  return Object.values(universes).some((u) => (u.rows?.length ?? 0) > 0);
}

async function loadFromGcsObject(objectName: string): Promise<FmpScreenerPayload | null> {
  const name = bucketName();
  if (!name) {
    console.error('[fundamentals-debug] no bucket name resolved');
    return null;
  }
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName).download();
  const parsed = JSON.parse(content.toString('utf8')) as FmpScreenerPayload;
  console.error(
    `[fundamentals-debug] GCS read OK bucket=${name} obj=${objectName} rows=${parsed.rows?.length ?? 'n/a'} connected=${parsed.connected}`,
  );
  return parsed;
}

async function loadFromGcs(): Promise<FmpScreenerPayload | null> {
  let lastError: unknown = null;
  for (const objectName of gcsObjectCandidates()) {
    try {
      const parsed = await loadFromGcsObject(objectName);
      if (hasScreenerRows(parsed)) return parsed;
      console.error(`[fundamentals-debug] GCS object empty or disconnected: ${objectName}`);
    } catch (e) {
      lastError = e;
      console.error(
        `[fundamentals-debug] GCS read FAILED obj=${objectName} err=${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  if (lastError) throw lastError;
  return null;
}

async function loadFromFile(): Promise<FmpScreenerPayload | null> {
  const jsonPath = process.env.SCANNER_FMP_JSON_PATH;
  if (jsonPath) {
    const raw = await readFile(jsonPath, 'utf8');
    return JSON.parse(raw) as FmpScreenerPayload;
  }

  if (process.env.NODE_ENV === 'development') {
    for (const rel of ['scanners/edgar_growth_screener.json', 'scanners/fmp_growth_screener.json']) {
      const localPath = `${process.cwd()}/../Projects/stocks/${rel}`;
      try {
        const raw = await readFile(localPath, 'utf8');
        return JSON.parse(raw) as FmpScreenerPayload;
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}

export async function loadFmpScreenerData(): Promise<FmpScreenerPayload> {
  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    const file = await loadFromFile().catch(() => null);
    if (file && hasScreenerRows(file)) return file;
  }

  const file = await loadFromFile().catch(() => null);
  if (file && hasScreenerRows(file)) return file;

  return {
    connected: false,
    message: 'Data is refreshing. Check back shortly.',
    rows: [],
  };
}
