import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type PeGlassHistoryPoint = {
  year?: string;
  epsIndex?: number;
  priceIndex?: number;
};

export type PeGlassBucketSummary = {
  key?: string;
  label?: string;
  periodCount?: number;
  avgPeriodReturnPct?: number | null;
  totalReturnPct?: number | null;
  cagrPct?: number | null;
  maxDrawdownPct?: number | null;
  hitRatePct?: number | null;
  avgNamesPerPeriod?: number | null;
};

export type PeGlassBacktest = {
  generatedAt?: string;
  asOf?: string;
  start?: string;
  end?: string;
  universe?: string;
  universeLabel?: string;
  topN?: number;
  rebalance?: string;
  method?: string[];
  headline?: string;
  note?: string;
  bestBucket?: PeGlassBucketSummary | null;
  buckets?: PeGlassBucketSummary[];
};

export type PeGlassBacktestCompareRow = {
  universe?: string;
  label?: string;
  bestBucketKey?: string;
  bestBucketLabel?: string;
  bestCagrPct?: number | null;
  roomCagrPct?: number | null;
  overflowCagrPct?: number | null;
  balancedCagrPct?: number | null;
  summary?: PeGlassBacktest | null;
};

export type PeGlassBacktestCompare = {
  generatedAt?: string;
  start?: string;
  end?: string;
  winnerUniverse?: string;
  winnerLabel?: string;
  headline?: string;
  note?: string;
  universes?: PeGlassBacktestCompareRow[];
};

export type PeGlassForwardBucket = {
  key?: string;
  label?: string;
  kind?: string;
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
  }>;
};

export type PeGlassForwardTest = {
  asOf?: string;
  updatedAt?: string;
  method?: string;
  buckets?: PeGlassForwardBucket[];
};

export type PeGlassRow = {
  ticker: string;
  company?: string;
  sector?: string;
  animal?: string;
  animalEmoji?: string;
  price12mPct?: number | null;
  earningsGrowthPct?: number | null;
  earningsLabel?: string;
  stretchGapPct?: number | null;
  earningsFillPct?: number;
  priceBeadPct?: number;
  verdict?: 'overflow' | 'stretched' | 'balanced' | 'catching' | 'room' | 'unknown';
  verdictLabel?: string;
  hint?: string;
  trailingPe?: number | null;
  scanCount?: number;
  momentumScore?: number | null;
  history?: PeGlassHistoryPoint[];
};

export type PeGlassPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  method?: string[];
  tickerCount?: number;
  summary?: {
    overflowCount?: number;
    roomCount?: number;
    headline?: string;
  };
  rows?: PeGlassRow[];
  bucketTop10?: Record<string, string[]>;
  forwardTest?: PeGlassForwardTest;
  backtest?: PeGlassBacktest | null;
  backtestCompare?: PeGlassBacktestCompare | null;
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_PE_GLASS_OBJECT || 'scanner/pe_glass_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<PeGlassPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as PeGlassPayload;
}

async function loadFromFile(): Promise<PeGlassPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates('SCANNER_PE_GLASS_JSON_PATH', 'pe_glass_dashboard.json')) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as PeGlassPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadPeGlassDashboard(): Promise<PeGlassPayload> {
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
    message: 'Data is refreshing. Check back shortly.',
    rows: [],
  };
}
