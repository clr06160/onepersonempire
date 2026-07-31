import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type EarningsCalendarStock = {
  ticker: string;
  company?: string;
  sector?: string;
  earningsDate: string;
  time?: string;
  timeLabel?: string;
  epsEstimated?: number | null;
  revenueEstimated?: number | null;
  earningsReactionScore?: number | null;
  immediateReactionPct?: number | null;
  threeDayReactionPct?: number | null;
  lastEarningsDate?: string | null;
  universes?: string[];
};

export type EarningsCalendarDay = {
  date: string;
  weekday?: string;
  count?: number;
  stocks: EarningsCalendarStock[];
};

export type EarningsForwardTrade = {
  ticker: string;
  earningsDate?: string;
  timeLabel?: string;
  entryDate?: string;
  exitDate?: string;
  entryPrice?: number | null;
  exitPrice?: number | null;
  stopPrice?: number | null;
  atr14?: number | null;
  returnPct?: number | null;
  exitReason?: string;
  stopped?: boolean;
  equityAfter?: number | null;
  company?: string;
  currentReturnPct?: number | null;
  lastPrice?: number | null;
  weightPct?: number | null;
  status?: string;
  threeDayReactionPct?: number | null;
};

export type EarningsForwardLive = {
  mode?: string;
  asOf?: string;
  startedAt?: string | null;
  initialCapital?: number;
  equity?: number;
  cash?: number;
  investedPct?: number | null;
  totalReturnPct?: number | null;
  openPosition?: EarningsForwardTrade | null;
  openPositions?: EarningsForwardTrade[];
  openCount?: number;
  scheduled?: EarningsForwardTrade[];
  recentClosed?: EarningsForwardTrade[];
  closedCount?: number;
  hitRatePct?: number | null;
  avgReturnPct?: number | null;
  equitySeries?: { date: string; equity: number; ticker?: string; returnPct?: number | null }[];
  rules?: {
    entryDaysBefore?: number;
    exitDaysAfter?: number;
    atrMultiple?: number;
    positionSize?: string;
  };
  note?: string;
};

export type EarningsForwardTest = {
  live?: EarningsForwardLive;
  method?: string[];
  error?: string;
};

export type EarningsCalendarPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  metric?: string;
  threshold?: number;
  lookaheadDays?: number;
  windowEnd?: string;
  criteria?: string;
  totalCount?: number;
  qualifierCount?: number;
  days?: EarningsCalendarDay[];
  note?: string;
  message?: string;
  forwardTest?: EarningsForwardTest;
};

function earningsObjectName() {
  return process.env.SCANNER_RESULTS_GCS_EARNINGS_OBJECT || 'scanner/earnings_calendar.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<EarningsCalendarPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(earningsObjectName()).download();
  return JSON.parse(content.toString('utf8')) as EarningsCalendarPayload;
}

async function loadFromFile(): Promise<EarningsCalendarPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_EARNINGS_JSON_PATH',
    'earnings_calendar_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as EarningsCalendarPayload;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function loadEarningsCalendarData(): Promise<EarningsCalendarPayload> {
  const local = await loadFromFile().catch(() => null);
  if (local) return local;

  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    // fall through to disconnected payload
  }

  return {
    connected: false,
    message: 'Earnings calendar not uploaded yet. Run the daily fundamentals refresh on your PC, then upload.',
    days: [],
  };
}
