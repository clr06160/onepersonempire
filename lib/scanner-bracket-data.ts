import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type BracketTone = 'buy' | 'sell' | 'watch' | 'neutral' | string;

export type BracketRow = {
  ticker: string;
  priorDate?: string;
  bracketHigh?: number | null;
  bracketLow?: number | null;
  buyCeiling?: number | null;
  sellFloor?: number | null;
  mid?: number | null;
  widthPct?: number | null;
  last?: number | null;
  dayHigh?: number | null;
  dayLow?: number | null;
  location?: string;
  failedBreakLong?: boolean;
  failedBreakShort?: boolean;
  action?: 'BUY' | 'SELL' | 'WATCH' | 'WAIT' | string;
  actionDetail?: string;
  tone?: BracketTone;
  edgeScore?: number | null;
  distToLowPct?: number | null;
  distToHighPct?: number | null;
  quoteSource?: string;
  focus?: boolean;
};

export type BracketRegime = {
  asOf?: string;
  qqqClose?: number | null;
  qqqMa200?: number | null;
  aboveMa200?: boolean;
  vol20AnnPct?: number | null;
  volBucket?: string;
  score?: number;
  fit?: string;
  fitLabel?: string;
  headline?: string;
  reasons?: string[];
};

export type BracketForward = {
  totalDays?: number;
  avgComboOvernightPct?: number | null;
  hitRatePct?: number | null;
  note?: string;
  recent?: Array<{
    asOf?: string;
    buyTickers?: string[];
    sellTickers?: string[];
    buyOvernightPct?: number | null;
    sellOvernightPct?: number | null;
    comboOvernightPct?: number | null;
  }>;
};

export type BracketPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  title?: string;
  subtitle?: string;
  method?: string[];
  regime?: BracketRegime;
  focus?: BracketRow[];
  buyCandidates?: BracketRow[];
  sellCandidates?: BracketRow[];
  rows?: BracketRow[];
  forwardTest?: BracketForward;
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_BRACKET_OBJECT || 'scanner/bracket_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<BracketPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as BracketPayload;
}

async function loadFromFile(): Promise<BracketPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_BRACKET_JSON_PATH',
    'bracket_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as BracketPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadBracketDashboard(): Promise<BracketPayload> {
  const local = await loadFromFile().catch(() => null);
  if (local) return local;

  try {
    const remote = await loadFromGcs();
    if (remote) return remote;
  } catch {
    // fall through
  }

  return {
    connected: false,
    message: 'Data is refreshing. Check back shortly.',
    buyCandidates: [],
    sellCandidates: [],
    rows: [],
  };
}
