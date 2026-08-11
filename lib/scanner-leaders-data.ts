import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import type {
  EarningsReactionBadge,
  EarningsReactionPrint,
  EarningsReactionStudyNote,
} from '@/lib/scanner-earnings-reaction';
import { loadEarningsReactionBadges } from '@/lib/scanner-earnings-reaction';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';
import type { PreEarningsWatchItem } from '@/lib/scanner-pre-earnings';
import { loadPreEarningsWatchlist } from '@/lib/scanner-pre-earnings';
import { WAVE4_PLAYBOOK, WAVE4_PRIORS } from '@/lib/scanner-wave4-rules';
import {
  computeWave4StatusMap,
  type Wave4TickerStatus,
} from '@/lib/scanner-wave4-status';

export type LeadersRule = {
  tone?: 'danger' | 'warning' | 'info' | string;
  title?: string;
  body?: string;
};

export type LeadersMicrosector = {
  key: string;
  label?: string;
  parent?: string;
  buildoutLayer?: string;
  eureka?: string[];
  tickerCount?: number;
  listedCount?: number;
  rs21?: number | null;
  rs63?: number | null;
  rs126?: number | null;
  breadthAbove50Pct?: number | null;
  breadthNearHighPct?: number | null;
  medianDistToHighPct?: number | null;
  stage?: string;
  leaders?: string[];
};

export type LeadersMember = {
  ticker: string;
  rs21?: number | null;
  rs63?: number | null;
  rs126?: number | null;
  distToHighPct?: number | null;
  above50dma?: boolean | null;
  salesGrowthPct?: number | null;
  epsGrowthPct?: number | null;
  lastClose?: number | null;
  earningsBadge?: EarningsReactionBadge | null;
  threeDayReactionPct?: number | null;
  immediateReactionPct?: number | null;
  lastEarningsDate?: string | null;
  earningsHistory?: EarningsReactionPrint[];
  wave4?: Wave4TickerStatus | null;
};

export type TrendOrphan = {
  ticker: string;
  rs63?: number | null;
  rs21?: number | null;
  distToHighPct?: number | null;
  industry?: string | null;
  sector?: string | null;
  salesGrowthPct?: number | null;
  epsGrowthPct?: number | null;
  earningsBadge?: EarningsReactionBadge | null;
  threeDayReactionPct?: number | null;
  earningsHistory?: EarningsReactionPrint[];
};

export type TrendCluster = {
  industry?: string;
  tickerCount?: number;
  medianRs63?: number | null;
  tickers?: string[];
  note?: string;
};

export type TrendPhrase = {
  phrase?: string;
  tickerCount?: number;
  tickers?: string[];
  example?: string;
};

export type TrendScout = {
  orphans?: TrendOrphan[];
  clusters?: TrendCluster[];
  risingPhrases?: TrendPhrase[];
  method?: string[];
};

export type LeadersPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  title?: string;
  subtitle?: string;
  benchmark?: {
    qqq?: Record<string, number | null | undefined>;
    xlkRsVsQqq?: Record<string, number | null | undefined>;
    note?: string;
  };
  defaultMicrosectorKey?: string | null;
  microsectors?: LeadersMicrosector[];
  membersByKey?: Record<string, LeadersMember[]>;
  trendScout?: TrendScout;
  method?: string[];
  operatingRules?: LeadersRule[];
  earningsReactionNote?: EarningsReactionStudyNote;
  earningsReactionThresholdPct?: number;
  preEarningsWatchlist?: PreEarningsWatchItem[];
  preEarningsWindowDays?: number;
  preEarningsAsOf?: string | null;
  wave4Playbook?: typeof WAVE4_PLAYBOOK;
  wave4Priors?: typeof WAVE4_PRIORS;
  wave4Summary?: {
    riding: number;
    extended: number;
    aboutDone: number;
    confirmedWave4: number;
    cooling: number;
    unknown: number;
    namesAboutDone: Array<{ ticker: string; status: string; note: string; microsector?: string }>;
  };
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_LEADERS_OBJECT || 'scanner/leaders_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<LeadersPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as LeadersPayload;
}

async function loadFromFile(): Promise<LeadersPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_LEADERS_JSON_PATH',
    'leaders_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as LeadersPayload;
    } catch {
      // try next
    }
  }
  return null;
}

async function enrichWithEarningsReactions(payload: LeadersPayload): Promise<LeadersPayload> {
  const [badges, preEarnings] = await Promise.all([
    loadEarningsReactionBadges(),
    loadPreEarningsWatchlist(),
  ]);
  const byTicker = badges.byTicker || {};
  const membersByKey: Record<string, LeadersMember[]> = {};
  for (const [key, members] of Object.entries(payload.membersByKey || {})) {
    membersByKey[key] = (members || []).map((member) => {
      const reaction = byTicker[String(member.ticker || '').toUpperCase()];
      if (!reaction) return member;
      return {
        ...member,
        earningsBadge: reaction.badge ?? null,
        threeDayReactionPct: reaction.threeDayReactionPct ?? null,
        immediateReactionPct: reaction.immediateReactionPct ?? null,
        lastEarningsDate: reaction.lastEarningsDate ?? null,
        earningsHistory: reaction.history || [],
      };
    });
  }

  const orphans = (payload.trendScout?.orphans || []).map((orphan) => {
    const reaction = byTicker[String(orphan.ticker || '').toUpperCase()];
    if (!reaction) return orphan;
    return {
      ...orphan,
      earningsBadge: reaction.badge ?? null,
      threeDayReactionPct: reaction.threeDayReactionPct ?? null,
      earningsHistory: reaction.history || [],
    };
  });

  return {
    ...payload,
    membersByKey,
    trendScout: payload.trendScout
      ? { ...payload.trendScout, orphans }
      : payload.trendScout,
    earningsReactionNote: badges.studyNote,
    earningsReactionThresholdPct: badges.thresholdPct ?? 10,
    preEarningsWatchlist: preEarnings.rows || [],
    preEarningsWindowDays: preEarnings.windowDays ?? 10,
    preEarningsAsOf: preEarnings.asOf ?? null,
  };
}

async function enrichWithWave4(payload: LeadersPayload): Promise<LeadersPayload> {
  const microsectors = payload.microsectors || [];
  const membersByKey = { ...(payload.membersByKey || {}) };
  const tickers: string[] = [];
  const tickerToMs: Record<string, string> = {};

  for (const ms of microsectors) {
    const leaders = (ms.leaders || []).map((t) => String(t).toUpperCase()).filter(Boolean);
    const members = membersByKey[ms.key] || [];
    const top = [...members]
      .sort((a, b) => (b.rs63 ?? -999) - (a.rs63 ?? -999))
      .slice(0, 5)
      .map((m) => String(m.ticker || '').toUpperCase())
      .filter(Boolean);
    for (const t of [...new Set([...leaders, ...top])]) {
      tickers.push(t);
      tickerToMs[t] = ms.label || ms.key;
    }
  }

  // Cap work for page latency — industry/sector come from each chart's fundamentals
  const capped = [...new Set(tickers)].slice(0, 80);
  const statusMap = capped.length ? await computeWave4StatusMap(capped, undefined, 6) : {};

  for (const [key, members] of Object.entries(membersByKey)) {
    membersByKey[key] = (members || []).map((member) => {
      const t = String(member.ticker || '').toUpperCase();
      const wave4 = statusMap[t];
      return wave4 ? { ...member, wave4 } : member;
    });
  }

  const summary = {
    riding: 0,
    extended: 0,
    aboutDone: 0,
    confirmedWave4: 0,
    cooling: 0,
    unknown: 0,
    namesAboutDone: [] as Array<{ ticker: string; status: string; note: string; microsector?: string }>,
  };

  for (const [t, st] of Object.entries(statusMap)) {
    if (st.status === 'riding') summary.riding += 1;
    else if (st.status === 'extended') summary.extended += 1;
    else if (st.status === 'about_done') summary.aboutDone += 1;
    else if (st.status === 'confirmed_wave4') summary.confirmedWave4 += 1;
    else if (st.status === 'cooling') summary.cooling += 1;
    else summary.unknown += 1;

    if (st.status === 'about_done' || st.status === 'confirmed_wave4') {
      summary.namesAboutDone.push({
        ticker: t,
        status: st.status,
        note: st.note,
        microsector: tickerToMs[t],
      });
    }
  }

  summary.namesAboutDone.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return {
    ...payload,
    membersByKey,
    wave4Playbook: WAVE4_PLAYBOOK,
    wave4Priors: WAVE4_PRIORS,
    wave4Summary: summary,
  };
}

export async function loadLeadersDashboard(): Promise<LeadersPayload> {
  const local = await loadFromFile().catch(() => null);
  const base = local
    ? await enrichWithEarningsReactions(local)
    : await (async () => {
        try {
          const remote = await loadFromGcs();
          if (remote) return enrichWithEarningsReactions(remote);
        } catch {
          // fall through
        }
        return null;
      })();

  if (base) {
    try {
      return await enrichWithWave4(base);
    } catch {
      return {
        ...base,
        wave4Playbook: WAVE4_PLAYBOOK,
        wave4Priors: WAVE4_PRIORS,
      };
    }
  }

  return {
    connected: false,
    message: 'Leaders data is refreshing. Check back shortly.',
    microsectors: [],
    membersByKey: {},
    trendScout: { orphans: [], clusters: [], risingPhrases: [] },
    operatingRules: [],
    method: [],
    wave4Playbook: WAVE4_PLAYBOOK,
    wave4Priors: WAVE4_PRIORS,
  };
}
