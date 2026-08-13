import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type DayTradeTone = 'buy' | 'watch' | 'fade' | 'neutral' | 'caution' | 'muted';

export type DayTradeDayDownZone = {
  id?: string;
  label?: string;
  tone?: string;
  sizeHint?: string;
  note?: string;
};

export type DayTradeSignal = {
  action: 'BUY' | 'WAIT' | 'NO_TRADE' | 'EXIT';
  headline: string;
  sub?: string;
  entry?: string | null;
  exit?: string | null;
  sizeHint?: string | null;
  dayDownZone?: DayTradeDayDownZone;
  bounceTier?: 'STRONG' | 'STANDARD' | null;
  whyNotBuy?: string | null;
  signalAsOf?: string;
  executionPhase?: 'ENTRY' | 'EXIT';
};

export type DayTradePrimarySignal = DayTradeSignal & {
  ticker?: string | null;
  pair?: string;
};

export type DayTradeCutoffRow = {
  zone: string;
  dayDown: string;
  bounceScore: string;
  signal: string;
  entry: string;
  backtest: string;
  plan: string;
};

export type DayTradeTicker = {
  ticker: string;
  pair: string;
  underlying?: string | null;
  direction: 'bull' | 'bear';
  label: string;
  price: number;
  asOf: string;
  change1dPct: number;
  change5dPct: number;
  underlyingChange1dPct?: number | null;
  rsi14?: number | null;
  distSma5Pct: number;
  distSma20Pct: number;
  zScore1d: number;
  atr14Pct?: number | null;
  bounceScore: number;
  fadeScore: number;
  overnightOpenPct?: number | null;
  bounceTier?: 'STRONG' | 'STANDARD' | null;
  setup: string;
  action: string;
  tone: DayTradeTone;
  detail: string;
  tradeSignal?: DayTradeSignal;
  dayDownZone?: DayTradeDayDownZone;
};

export type DayTradePair = {
  bull: DayTradeTicker | null;
  bear: DayTradeTicker | null;
  underlying?: string | null;
};

export type LearnedPainContext = {
  badge?: string;
  action?: string;
  scalePct?: number;
  painProb20dPct?: string;
  painProb60dPct?: string;
  reason?: string;
  asOf?: string;
  note?: string;
};

export type DayTradeHistMetric = {
  winRatePct?: number;
  avgPct?: number;
  medianPct?: number;
  p75Pct?: number;
};

export type DayTradeHistEntry = {
  count?: number;
  entry?: string;
  sameDayHigh?: DayTradeHistMetric;
  sameDayClose?: DayTradeHistMetric;
  sameDayLow?: DayTradeHistMetric;
  hold4DayClose?: DayTradeHistMetric;
};

export type DayTradeHistoricalPair = {
  bull: string;
  label: string;
  signalCount?: number;
  nextOpen?: DayTradeHistEntry;
  crashClose?: DayTradeHistEntry;
};

export type DayTradeHistoricalStats = {
  start?: string;
  bounceCutoff?: number;
  note?: string;
  pairs?: DayTradeHistoricalPair[];
};

export type DayTradeBounceTierGuide = {
  title?: string;
  summary?: string;
  strongPattern?: string[];
  closing?: string;
  howToRead?: {
    overnightOpenPct?: string;
    STRONG?: string;
    STANDARD?: string;
  };
};

export type DayTradeBounceTierMetric = {
  count?: number;
  winRatePct?: number;
  avgFwdPct?: number;
  medianFwdPct?: number;
  p75FwdPct?: number;
  avgExcessVsQqqPct?: number;
};

export type DayTradeBounceTierBacktest = {
  start?: string;
  bounceCutoff?: number;
  note?: string;
  pairs?: Array<{
    ticker: string;
    label?: string;
    tiers?: Record<string, DayTradeBounceTierMetric>;
  }>;
};

export type DayTradeSoxsSignal = {
  action: 'BUY' | 'ARMED' | 'HOLD' | 'SELL' | 'WAIT';
  headline: string;
  detail?: string;
  signalDate?: string;
  entryDate?: string;
  entryPrice?: number;
  exitPrice?: number;
  returnPct?: number;
  pnl?: number;
  exitPlan?: string | null;
  paperStatus?: string;
};

export type DayTradeSoxsPaperTrade = {
  ticker?: string;
  entryDate?: string;
  entryPrice?: number;
  exitDate?: string;
  exitPrice?: number;
  returnPct?: number;
  pnl?: number;
  holdSessions?: number;
  exitReason?: string;
  openReturnPct?: number;
  openPnl?: number;
  lastPrice?: number;
};

export type DayTradeSoxsFailedBounce = {
  strategyId?: string;
  title?: string;
  signal?: DayTradeSoxsSignal;
  paper?: {
    startedAt?: string;
    notionalPerTrade?: number;
    closedTrades?: number;
    wins?: number;
    winRatePct?: number | null;
    avgReturnPct?: number | null;
    totalPnl?: number;
    openPosition?: DayTradeSoxsPaperTrade | null;
    recentClosed?: DayTradeSoxsPaperTrade[];
  };
  backtest?: {
    trades?: number;
    winRatePct?: number;
    avgReturnPct?: number;
    medianReturnPct?: number;
    avgWinPct?: number;
    avgLossPct?: number;
    worstPct?: number;
    profitFactor?: number;
    note?: string;
  };
  rules?: string[];
  forwardOnly?: boolean;
  stateAsOf?: string;
};

export type DayTradeBounceFailArmor = {
  strategyId?: string;
  title?: string;
  signal?: DayTradeSoxsSignal & { ticker?: string };
  tickerSignals?: Array<DayTradeSoxsSignal & { ticker?: string }>;
  paper?: {
    startedAt?: string;
    notionalPerTrade?: number;
    closedTrades?: number;
    wins?: number;
    winRatePct?: number | null;
    avgReturnPct?: number | null;
    totalPnl?: number;
    openPosition?: DayTradeSoxsPaperTrade | null;
    openPositions?: DayTradeSoxsPaperTrade[];
    recentClosed?: DayTradeSoxsPaperTrade[];
  };
  backtest?: {
    trades?: number;
    winRatePct?: number;
    avgReturnPct?: number;
    medianReturnPct?: number;
    avgWinPct?: number;
    avgLossPct?: number;
    worstPct?: number;
    profitFactor?: number;
    note?: string;
  };
  rules?: string[];
  forwardOnly?: boolean;
  stateAsOf?: string;
};

export type DayTradePayload = {
  connected?: boolean;
  generatedAt?: string;
  primarySignal?: DayTradePrimarySignal | null;
  practicalCutoffs?: DayTradeCutoffRow[];
  method?: string[];
  playbook?: string[];
  historicalStats?: DayTradeHistoricalStats;
  bounceTierGuide?: DayTradeBounceTierGuide;
  bounceTierBacktest?: DayTradeBounceTierBacktest;
  soxsFailedBounce?: DayTradeSoxsFailedBounce | null;
  bounceFailArmor?: DayTradeBounceFailArmor | null;
  learnedPain?: LearnedPainContext;
  tickerCount?: number;
  missed?: string[];
  topBounce?: DayTradeTicker[];
  pairs?: DayTradePair[];
  tickers?: Record<string, DayTradeTicker>;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_DAYTRADE_OBJECT || 'scanner/daytrade_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<DayTradePayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as DayTradePayload;
}

async function loadFromFile(): Promise<DayTradePayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_DAYTRADE_JSON_PATH',
    'daytrade_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as DayTradePayload;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function loadScannerDayTradeData(): Promise<DayTradePayload> {
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
    tickers: {},
    pairs: [],
    topBounce: [],
  };
}
