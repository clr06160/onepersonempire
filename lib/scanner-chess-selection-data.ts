import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type ChessSelectionHolding = {
  ticker: string;
  rank?: number;
  selectionScore?: number;
  weightPct?: number;
  status?: 'ADD' | 'HOLD' | 'PRESSED' | string;
  openedAt?: string;
  holdingDays?: number;
  targetHoldingDays?: number;
  entryPrice?: number;
  currentPrice?: number;
  openReturnPct?: number;
  roomToRunPct?: number;
  netIncomeGrowthPct?: number;
  ret63Pct?: number;
  drawdownFromPeak21Pct?: number;
};

export type ChessSelectionChange = {
  date?: string;
  type?: string;
  added?: string[];
  removed?: string[];
  holdings?: string[];
  weights?: Array<{ ticker: string; weightPct: number }>;
  exposurePct?: number;
  reason?: string;
};

export type ChessSelectionVariant = {
  id: string;
  label: string;
  shortLabel?: string;
  description?: string;
  asOf?: string;
  exposurePct?: number;
  holdings?: ChessSelectionHolding[];
  additions?: string[];
  removals?: string[];
  management?: string[];
  pressedTicker?: string | null;
  metrics?: {
    updates?: number;
    equity?: number;
    totalReturnPct?: number;
    qqqReturnPct?: number;
    edgeQqqPct?: number;
    maxDrawdownPct?: number;
    closedTrades?: number;
  };
  recentChanges?: ChessSelectionChange[];
  recentClosed?: Array<{
    ticker?: string;
    openedAt?: string;
    closedAt?: string;
    holdingDays?: number;
    entryPrice?: number;
    exitPrice?: number;
    returnPct?: number;
  }>;
  equitySeries?: Array<{
    date: string;
    equity: number;
    benchmarkEquity?: number;
    returnPct?: number;
    qqqReturnPct?: number;
    exposurePct?: number;
  }>;
};

export type ChessSelectionLesson = {
  status?: string;
  summary?: string;
  rules?: string[];
  evidence?: string;
};

export type ChessSelectionPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  title?: string;
  subtitle?: string;
  forwardOnly?: boolean;
  learned?: {
    chess?: ChessSelectionLesson;
    selection?: ChessSelectionLesson;
    regime?: ChessSelectionLesson;
    raw10?: ChessSelectionLesson;
    winners?: ChessSelectionLesson;
    climateSwitch?: ChessSelectionLesson;
  };
  strategy?: {
    selectionModelId?: string;
    rosterSize?: number;
    targetHoldingSessions?: number;
    reviewCadence?: string;
    weights?: Record<string, number>;
    rules?: Record<string, number | Record<string, number>>;
    disclaimer?: string;
  };
  regime?: {
    asOf?: string;
    climate?: string;
    posture?: string;
    exposurePct?: number;
    preflipWarning?: boolean;
    warnings?: {
      oilSpike?: boolean;
      rateSensitiveCrack?: boolean;
      defensivesLead?: boolean;
    };
    rotation?: {
      oil63Pct?: number;
      cyclicalDefensiveSpreadPct?: number;
      techRsPct?: number;
      crackingFirst?: string[];
      rateSensitiveRsPct?: Record<string, number>;
    };
    existingScanner?: {
      label?: string;
      badge?: string;
      scalePct?: number;
      reason?: string;
    };
    switch?: {
      bucket?: string;
      metric?: string;
      reason?: string;
    };
    note?: string;
  };
  variants?: ChessSelectionVariant[];
  candidateBoard?: Array<{
    ticker: string;
    rank?: number;
    score?: number;
    close?: number;
    roomToRun?: number;
    netIncomeGrowth?: number;
    baseThenGap?: number;
    buffettQuality?: number;
    ret21Pct?: number;
    ret63Pct?: number;
    ret126Pct?: number;
  }>;
  raw10Board?: Array<{
    ticker: string;
    rank?: number;
    score?: number;
    close?: number;
    roomToRun?: number;
    ret21Pct?: number;
    ret63Pct?: number;
    ret126Pct?: number;
    drawdownFromPeak21Pct?: number;
  }>;
  winnersBoard?: Array<{
    ticker: string;
    rank?: number;
    score?: number;
    close?: number;
    roomToRun?: number;
    lastYearRetPct?: number;
    ret21Pct?: number;
    ret63Pct?: number;
    ret126Pct?: number;
    drawdownFromPeak21Pct?: number;
  }>;
  climateSwitchBoard?: Array<{
    ticker: string;
    rank?: number;
    score?: number;
    close?: number;
    roomToRun?: number;
    lastYearRetPct?: number;
    gapFromSma200Pct?: number;
    activeMetric?: string;
    climateBucket?: string;
    ret21Pct?: number;
    ret63Pct?: number;
    ret126Pct?: number;
  }>;
  note?: string;
  message?: string;
  source?: string;
};

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function objectName() {
  return process.env.SCANNER_CHESS_SELECTION_GCS_OBJECT || 'scanner/chess_selection_dashboard.json';
}

async function loadFromGcs(): Promise<ChessSelectionPayload | null> {
  const bucket = bucketName();
  if (!bucket) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(bucket).file(objectName()).download();
  return { ...(JSON.parse(content.toString('utf8')) as ChessSelectionPayload), source: 'gcs' };
}

async function loadFromFile(): Promise<ChessSelectionPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_CHESS_SELECTION_JSON_PATH',
    'chess_selection_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return { ...(JSON.parse(raw) as ChessSelectionPayload), source: 'file' };
    } catch {
      // Try the next local candidate.
    }
  }
  return null;
}

export async function loadChessSelectionDashboard(): Promise<ChessSelectionPayload> {
  const local = await loadFromFile();
  if (local) return local;

  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    // Fall through to the not-built response.
  }

  return {
    connected: false,
    variants: [],
    message: 'Data is refreshing. Check back shortly.',
  };
}
