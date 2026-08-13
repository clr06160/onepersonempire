import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import type { EarningsCauseTag } from '@/lib/scanner-earnings-plain-facts';
import { deriveEarningsPlainFacts } from '@/lib/scanner-earnings-plain-facts';
import type { EarningsReactionBadge } from '@/lib/scanner-earnings-reaction';
import { loadEarningsReactionBadges } from '@/lib/scanner-earnings-reaction';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type PreEarningsWatchItem = {
  ticker: string;
  earningsDate: string;
  time?: string;
  timeLabel?: string;
  epsEstimated?: number | null;
  revenueEstimated?: number | null;
  parent?: string | null;
  microsector?: string | null;
  microsectorKey?: string | null;
  earningsBadge?: EarningsReactionBadge | null;
  threeDayReactionPct?: number | null;
  immediateReactionPct?: number | null;
  lastEarningsDate?: string | null;
  causeTags?: EarningsCauseTag[];
  plainLine?: string | null;
};

export type PreEarningsWatchlistPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  windowDays?: number;
  windowEnd?: string;
  thresholdPct?: number;
  leadersTickerCount?: number;
  count?: number;
  rows?: PreEarningsWatchItem[];
  method?: string[];
  message?: string;
};

function objectName() {
  return (
    process.env.SCANNER_RESULTS_GCS_LEADERS_PRE_EARNINGS_OBJECT ||
    'scanner/leaders_pre_earnings.json'
  );
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<PreEarningsWatchlistPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as PreEarningsWatchlistPayload;
}

async function loadFromFile(): Promise<PreEarningsWatchlistPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_LEADERS_PRE_EARNINGS_JSON_PATH',
    'leaders_pre_earnings.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as PreEarningsWatchlistPayload;
    } catch {
      // try next
    }
  }
  return null;
}

/** Re-derive plain facts from badge history so tag vocab stays current. */
async function refreshPlainFacts(
  payload: PreEarningsWatchlistPayload,
): Promise<PreEarningsWatchlistPayload> {
  const badges = await loadEarningsReactionBadges();
  const byTicker = badges.byTicker || {};
  const rows = (payload.rows || []).map((row) => {
    const history = byTicker[String(row.ticker || '').toUpperCase()]?.history || [];
    const latest = history[0];
    const prior = history[1];
    if (!latest) {
      return {
        ...row,
        causeTags: row.causeTags || [],
        plainLine: row.plainLine ?? null,
      };
    }
    const derived = deriveEarningsPlainFacts({
      eps: latest.eps ?? null,
      epsEstimated: latest.epsEstimated ?? null,
      revenue: latest.revenue ?? null,
      revenueEstimated: latest.revenueEstimated ?? null,
      priorEps: prior?.eps ?? null,
      priorRevenue: prior?.revenue ?? null,
    });
    const reaction = byTicker[String(row.ticker || '').toUpperCase()];
    return {
      ...row,
      earningsBadge: reaction?.badge ?? row.earningsBadge ?? null,
      threeDayReactionPct: reaction?.threeDayReactionPct ?? row.threeDayReactionPct ?? null,
      immediateReactionPct: reaction?.immediateReactionPct ?? row.immediateReactionPct ?? null,
      lastEarningsDate: reaction?.lastEarningsDate ?? row.lastEarningsDate ?? null,
      causeTags: derived.causeTags,
      plainLine: derived.plainLine,
    };
  });
  return { ...payload, rows, connected: true };
}

export async function loadPreEarningsWatchlist(): Promise<PreEarningsWatchlistPayload> {
  const local = await loadFromFile().catch(() => null);
  if (local?.rows?.length) return refreshPlainFacts(local);

  try {
    const remote = await loadFromGcs();
    if (remote?.rows?.length) return refreshPlainFacts(remote);
    if (remote) return { ...remote, connected: Boolean(remote.connected) };
  } catch {
    // fall through
  }

  return {
    connected: false,
    rows: [],
    count: 0,
    message: 'Pre-earnings watchlist refreshing.',
    method: [],
  };
}
