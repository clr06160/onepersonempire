import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type FirstPullbackRow = {
  ticker: string;
  rank?: number;
  close?: number | null;
  accel20Pct?: number | null;
  roc20Pct?: number | null;
  entryDate?: string | null;
  pullLow?: number | null;
  peak?: number | null;
  thrustPct?: number | null;
  retracePct?: number | null;
  inTopBook?: boolean;
};

export type FirstPullbackHolding = {
  ticker: string;
  rank?: number;
  entryPrice?: number | null;
  lastPrice?: number | null;
  openReturnPct?: number | null;
  accel20Pct?: number | null;
  roc20Pct?: number | null;
  entryDate?: string | null;
};

export type FirstPullbackBook = {
  id?: string;
  label?: string;
  asOf?: string;
  rebalancedToday?: boolean;
  openCount?: number;
  currentTickers?: string[];
  holdings?: FirstPullbackHolding[];
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
    month?: string;
  }>;
};

export type FirstPullbackRegime = {
  asOf?: string;
  qqqClose?: number | null;
  qqqMa200?: number | null;
  aboveMa200?: boolean;
  vol20AnnPct?: number | null;
  volBucket?: 'high' | 'mid' | 'low' | string;
  volTercileCutsPct?: { lowMax?: number; highMin?: number };
  score?: number;
  fit?: 'favorable' | 'mixed' | 'unfavorable' | string;
  fitLabel?: string;
  headline?: string;
  reasons?: string[];
  hint?: string;
  legend?: {
    favorable?: string;
    mixed?: string;
    unfavorable?: string;
  };
};

export type FirstPullbackRegimeTrackBucket = {
  fit?: string;
  days?: number;
  avgEdgeFpMinusAccelPct?: number | null;
  avgFpDayPct?: number | null;
  avgAccelDayPct?: number | null;
};

export type FirstPullbackRegimeTrack = {
  startedAt?: string;
  asOf?: string;
  totalDays?: number;
  calendarDays?: number;
  note?: string;
  byFit?: FirstPullbackRegimeTrackBucket[];
  recent?: Array<{
    asOf?: string;
    fit?: string;
    edgeFpMinusAccelPct?: number | null;
    fpDayPct?: number | null;
    accelDayPct?: number | null;
  }>;
};

export type FirstPullbackPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  title?: string;
  subtitle?: string;
  method?: string[];
  topN?: number;
  fpLookbackSessions?: number;
  poolCount?: number;
  regime?: FirstPullbackRegime;
  regimeTrack?: FirstPullbackRegimeTrack;
  backtestNote?: string;
  top?: string[];
  rows?: FirstPullbackRow[];
  book?: FirstPullbackBook;
  controlBook?: FirstPullbackBook;
  forwardTest?: {
    asOf?: string;
    updatedAt?: string;
    method?: string;
    books?: FirstPullbackBook[];
  };
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_FIRST_PULLBACK_OBJECT || 'scanner/first_pullback_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<FirstPullbackPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as FirstPullbackPayload;
}

async function loadFromFile(): Promise<FirstPullbackPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_FIRST_PULLBACK_JSON_PATH',
    'first_pullback_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as FirstPullbackPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadFirstPullbackDashboard(): Promise<FirstPullbackPayload> {
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
    rows: [],
    top: [],
  };
}
