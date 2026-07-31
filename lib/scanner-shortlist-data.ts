import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type ShortlistScanContext = {
  systemId?: string;
  systemLabel?: string;
  role?: string;
  rank?: number | null;
  source?: string;
  universeKey?: string;
  universeLabel?: string;
};

export type ShortlistAnimal = {
  animal?: string;
  label?: string;
  tone?: string;
};

export type ShortlistRow = {
  rank?: number;
  ticker: string;
  company?: string;
  sector?: string;
  bestScanRank?: number | null;
  scanCount?: number;
  scanContexts?: ShortlistScanContext[];
  systems?: string[];
  sixWeekSetupScore?: number | null;
  runwayScore?: number | null;
  musicStopsRisk?: number | null;
  animal?: ShortlistAnimal | null;
  flowSignal?: string;
  flowAccumulating?: boolean;
  price?: number | null;
  priceDate?: string | null;
  inTopTenBook?: boolean;
};

export type ShortlistDisqualifiedRow = ShortlistRow & {
  reasons?: string[];
};

export type ShortlistPosition = {
  ticker: string;
  company?: string;
  entryDate?: string;
  entryPrice?: number | null;
  lastDate?: string;
  lastPrice?: number | null;
  currentReturnPct?: number | null;
  returnPct?: number | null;
  maxDrawdownPct?: number | null;
  daysHeld?: number | null;
  entryShortlistRank?: number | null;
  lastShortlistRank?: number | null;
  status?: string;
  exitDate?: string;
  exitPrice?: number | null;
};

export type ShortlistTrade = {
  date?: string;
  type?: string;
  added?: string[];
  removed?: string[];
  holdings?: string[];
};

export type ShortlistTradeSummary = {
  count?: number;
  avgReturnPct?: number | null;
  medianReturnPct?: number | null;
  hitRatePct?: number | null;
};

export type ShortlistEquityPoint = {
  date?: string;
  equity?: number;
  basketReturnPct?: number;
  holdings?: string[];
};

export type ShortlistForwardTest = {
  asOf?: string;
  updatedAt?: string;
  startedAt?: string | null;
  initialCapital?: number;
  equity?: number;
  totalReturnPct?: number | null;
  maxDrawdownPct?: number | null;
  tradingDays?: number;
  holdings?: string[];
  openPositions?: ShortlistPosition[];
  openSummary?: ShortlistTradeSummary;
  closedSummary?: ShortlistTradeSummary;
  recentClosed?: ShortlistPosition[];
  recentTrades?: ShortlistTrade[];
  equitySeries?: ShortlistEquityPoint[];
  note?: string;
};

export type ShortlistPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  scannerGeneratedAt?: string;
  source?: string;
  method?: string[];
  requestedTickerCount?: number;
  tickerCount?: number;
  disqualifiedCount?: number;
  topTenCount?: number;
  portfolio?: ShortlistRow[];
  rows?: ShortlistRow[];
  disqualified?: ShortlistDisqualifiedRow[];
  forwardTest?: ShortlistForwardTest | null;
  note?: string;
  message?: string;
};

function shortlistObjectName() {
  return process.env.SCANNER_RESULTS_GCS_SHORTLIST_OBJECT || 'scanner/shortlist_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<ShortlistPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(shortlistObjectName()).download();
  return JSON.parse(content.toString('utf8')) as ShortlistPayload;
}

async function loadFromFile(): Promise<ShortlistPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_SHORTLIST_JSON_PATH',
    'shortlist_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as ShortlistPayload;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function loadScannerShortlistData(): Promise<ShortlistPayload> {
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
    message: 'Top Ten shortlist has not been uploaded yet. Run the scanner refresh on your PC, then upload.',
    rows: [],
  };
}
