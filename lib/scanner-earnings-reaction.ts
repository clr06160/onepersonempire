import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type EarningsReactionBadge = 'pass' | 'fail' | 'neutral';

export type EarningsReactionPrint = {
  reportDate: string;
  day0Date?: string;
  day3Date?: string;
  day0Pct?: number | null;
  day3Pct?: number | null;
  eps?: number | null;
  epsEstimated?: number | null;
  revenue?: number | null;
  revenueEstimated?: number | null;
  causeTags?: string[];
  plainLine?: string | null;
};

export type EarningsReactionTicker = {
  ticker: string;
  badge?: EarningsReactionBadge | null;
  threeDayReactionPct?: number | null;
  immediateReactionPct?: number | null;
  earningsReactionScore?: number | null;
  lastEarningsDate?: string | null;
  history?: EarningsReactionPrint[];
};

export type EarningsReactionStudyBucket = {
  n?: number;
  medianFwdToNextPrintPct?: number;
  redByNextPrintPct?: number;
  madeNewHighBeforeNextPct?: number;
};

export type EarningsReactionStudyNote = {
  signal?: string;
  thresholdPct?: number;
  universe?: string;
  passPlus?: EarningsReactionStudyBucket;
  failMinus?: EarningsReactionStudyBucket;
  blurb?: string;
};

export type EarningsReactionBadgesPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  thresholdPct?: number;
  signal?: string;
  tickerCount?: number;
  passCount?: number;
  failCount?: number;
  studyNote?: EarningsReactionStudyNote;
  byTicker?: Record<string, EarningsReactionTicker>;
  method?: string[];
  message?: string;
};

function objectName() {
  return (
    process.env.SCANNER_RESULTS_GCS_EARNINGS_REACTION_OBJECT ||
    'scanner/earnings_reaction_badges.json'
  );
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<EarningsReactionBadgesPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as EarningsReactionBadgesPayload;
}

async function loadFromFile(): Promise<EarningsReactionBadgesPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_EARNINGS_REACTION_JSON_PATH',
    'earnings_reaction_badges.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as EarningsReactionBadgesPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadEarningsReactionBadges(): Promise<EarningsReactionBadgesPayload> {
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
    message: 'Earnings reaction badges refreshing.',
    byTicker: {},
    studyNote: undefined,
    method: [],
  };
}

export function reactionBadgeFor(threeDay?: number | null, threshold = 10): EarningsReactionBadge | null {
  if (threeDay == null || Number.isNaN(threeDay)) return null;
  if (threeDay >= threshold) return 'pass';
  if (threeDay <= -threshold) return 'fail';
  return 'neutral';
}

export function getTickerReaction(
  payload: EarningsReactionBadgesPayload | null | undefined,
  ticker: string,
): EarningsReactionTicker | undefined {
  const key = String(ticker || '').toUpperCase();
  if (!key) return undefined;
  return payload?.byTicker?.[key];
}
