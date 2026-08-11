import type { LeadersPayload } from '@/lib/scanner-leaders-data';
import { loadLeadersDashboard } from '@/lib/scanner-leaders-data';
import type {
  EarningsReactionBadge,
  EarningsReactionBadgesPayload,
  EarningsReactionPrint,
} from '@/lib/scanner-earnings-reaction';
import { loadEarningsReactionBadges, reactionBadgeFor } from '@/lib/scanner-earnings-reaction';
import {
  deriveEarningsPlainFacts,
  type EarningsCauseTag,
} from '@/lib/scanner-earnings-plain-facts';

export type MonthlyReportPrint = {
  ticker: string;
  reportDate: string;
  day0Pct?: number | null;
  day3Pct?: number | null;
  badge?: EarningsReactionBadge | null;
  parent?: string | null;
  microsector?: string | null;
  microsectorKey?: string | null;
  eps?: number | null;
  epsEstimated?: number | null;
  revenue?: number | null;
  revenueEstimated?: number | null;
  causeTags?: EarningsCauseTag[];
  plainLine?: string | null;
};

export type MonthlyParentStat = {
  parent: string;
  printCount: number;
  passCount: number;
  failCount: number;
  medianDay3Pct: number | null;
};

export type MonthlyReportMonth = {
  month: string;
  label: string;
  printCount: number;
  passCount: number;
  failCount: number;
  neutralCount: number;
  medianDay3Pct: number | null;
  meanDay3Pct: number | null;
  passRatePct: number | null;
  failRatePct: number | null;
  winners: MonthlyReportPrint[];
  losers: MonthlyReportPrint[];
  allPrints: MonthlyReportPrint[];
  byParent: MonthlyParentStat[];
  topTags: { tag: string; count: number }[];
  conclusions: string[];
};

export type MonthlyReportsPayload = {
  connected: boolean;
  generatedAt?: string;
  asOf?: string;
  thresholdPct: number;
  signal: string;
  leadersTickerCount: number;
  months: MonthlyReportMonth[];
  defaultMonth?: string | null;
  studyBlurb?: string;
  method?: string[];
  message?: string;
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round1((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return round1(sorted[mid]);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES[m - 1] || ym} ${y}`;
}

function leadersTickerMeta(leaders: LeadersPayload): {
  tickers: Set<string>;
  meta: Record<string, { parent?: string; microsector?: string; microsectorKey?: string }>;
} {
  const tickers = new Set<string>();
  const meta: Record<string, { parent?: string; microsector?: string; microsectorKey?: string }> = {};
  const microByKey = new Map(
    (leaders.microsectors || []).map((row) => [row.key, row] as const),
  );

  for (const [key, members] of Object.entries(leaders.membersByKey || {})) {
    const ms = microByKey.get(key);
    for (const member of members || []) {
      const ticker = String(member.ticker || '').toUpperCase();
      if (!ticker) continue;
      tickers.add(ticker);
      if (!meta[ticker]) {
        meta[ticker] = {
          parent: ms?.parent || undefined,
          microsector: ms?.label || key,
          microsectorKey: key,
        };
      }
    }
  }

  for (const orphan of leaders.trendScout?.orphans || []) {
    const ticker = String(orphan.ticker || '').toUpperCase();
    if (!ticker) continue;
    tickers.add(ticker);
    if (!meta[ticker]) {
      meta[ticker] = {
        parent: orphan.sector || 'Trend Scout',
        microsector: orphan.industry || 'Orphan',
        microsectorKey: undefined,
      };
    }
  }

  return { tickers, meta };
}

function enrichPrintFacts(
  print: EarningsReactionPrint,
  prior: EarningsReactionPrint | null | undefined,
): Pick<
  MonthlyReportPrint,
  'eps' | 'epsEstimated' | 'revenue' | 'revenueEstimated' | 'causeTags' | 'plainLine'
> {
  const eps = print.eps ?? null;
  const epsEstimated = print.epsEstimated ?? null;
  const revenue = print.revenue ?? null;
  const revenueEstimated = print.revenueEstimated ?? null;

  // Always re-derive tags/lines from numbers so vocab updates apply without badge rebuild.
  // Prefer stored fundamentals; ignore stale causeTags/plainLine from older badge builds.
  const derived = deriveEarningsPlainFacts({
    eps,
    epsEstimated,
    revenue,
    revenueEstimated,
    priorEps: prior?.eps ?? null,
    priorRevenue: prior?.revenue ?? null,
  });

  return {
    eps,
    epsEstimated,
    revenue,
    revenueEstimated,
    causeTags: derived.causeTags,
    plainLine: derived.plainLine,
  };
}

function collectPrints(
  badges: EarningsReactionBadgesPayload,
  tickers: Set<string>,
  meta: Record<string, { parent?: string | null; microsector?: string | null; microsectorKey?: string | null }>,
  threshold: number,
): MonthlyReportPrint[] {
  const out: MonthlyReportPrint[] = [];
  for (const ticker of tickers) {
    const row = badges.byTicker?.[ticker];
    const history = row?.history || [];
    const info = meta[ticker] || {};

    if (history.length) {
      // history is newest-first; prior print for sequential compare is the next older row
      for (let i = 0; i < history.length; i++) {
        const print = history[i];
        const prior = history[i + 1] || null;
        const facts = enrichPrintFacts(print, prior);
        const day3 = print.day3Pct;
        out.push({
          ticker,
          reportDate: print.reportDate,
          day0Pct: print.day0Pct ?? null,
          day3Pct: day3 ?? null,
          badge: reactionBadgeFor(day3, threshold),
          parent: info.parent ?? null,
          microsector: info.microsector ?? null,
          microsectorKey: info.microsectorKey ?? null,
          ...facts,
        });
      }
      continue;
    }

    // Fallback: latest-only if history missing
    if (row?.threeDayReactionPct != null && row.lastEarningsDate) {
      out.push({
        ticker,
        reportDate: String(row.lastEarningsDate).slice(0, 10),
        day0Pct: row.immediateReactionPct ?? null,
        day3Pct: row.threeDayReactionPct,
        badge: row.badge ?? reactionBadgeFor(row.threeDayReactionPct, threshold),
        parent: info.parent ?? null,
        microsector: info.microsector ?? null,
        microsectorKey: info.microsectorKey ?? null,
        causeTags: [],
        plainLine: null,
      });
    }
  }
  return out;
}

function parentStats(prints: MonthlyReportPrint[]): MonthlyParentStat[] {
  const buckets = new Map<string, number[]>();
  const pass = new Map<string, number>();
  const fail = new Map<string, number>();

  for (const print of prints) {
    const parent = print.parent || 'Other';
    const day3 = print.day3Pct;
    if (day3 == null || Number.isNaN(day3)) continue;
    if (!buckets.has(parent)) buckets.set(parent, []);
    buckets.get(parent)!.push(day3);
    if (print.badge === 'pass') pass.set(parent, (pass.get(parent) || 0) + 1);
    if (print.badge === 'fail') fail.set(parent, (fail.get(parent) || 0) + 1);
  }

  return [...buckets.entries()]
    .map(([parent, values]) => ({
      parent,
      printCount: values.length,
      passCount: pass.get(parent) || 0,
      failCount: fail.get(parent) || 0,
      medianDay3Pct: median(values),
    }))
    .sort((a, b) => (b.medianDay3Pct ?? -999) - (a.medianDay3Pct ?? -999));
}

function topCauseTags(prints: MonthlyReportPrint[], limit = 6): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const print of prints) {
    for (const tag of print.causeTags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

function buildConclusions(month: Omit<MonthlyReportMonth, 'conclusions'>): string[] {
  const lines: string[] = [];
  const { printCount, passCount, failCount, medianDay3Pct, passRatePct, failRatePct, byParent, winners, losers, topTags } =
    month;

  if (!printCount) {
    return ['No Leaders earnings prints settled in this month yet.'];
  }

  const med =
    medianDay3Pct != null ? `${medianDay3Pct >= 0 ? '+' : ''}${medianDay3Pct}%` : '—';
  lines.push(
    `${printCount} prints. ${passCount} PASS+ (≥+10%${passRatePct != null ? `, ${passRatePct}%` : ''}). ${failCount} FAIL− (≤−10%${failRatePct != null ? `, ${failRatePct}%` : ''}). Median day+3 ${med}.`,
  );

  const hotParents = byParent.filter((p) => p.printCount >= 3 && (p.medianDay3Pct ?? 0) >= 5).slice(0, 2);
  const coldParents = [...byParent]
    .filter((p) => p.printCount >= 3 && (p.medianDay3Pct ?? 0) <= -3)
    .sort((a, b) => (a.medianDay3Pct ?? 0) - (b.medianDay3Pct ?? 0))
    .slice(0, 2);

  if (hotParents.length) {
    lines.push(
      `Higher reaction parents: ${hotParents
        .map((p) => `${p.parent} (med ${p.medianDay3Pct! >= 0 ? '+' : ''}${p.medianDay3Pct}%, ${p.passCount} PASS+)`)
        .join('; ')}.`,
    );
  }
  if (coldParents.length) {
    lines.push(
      `Lower reaction parents: ${coldParents
        .map((p) => `${p.parent} (med ${p.medianDay3Pct}%, ${p.failCount} FAIL−)`)
        .join('; ')}.`,
    );
  }

  if (topTags.length) {
    lines.push(`Common facts: ${topTags.map((t) => `${t.tag} (${t.count})`).join(', ')}.`);
  }

  if (winners[0] && losers[0]) {
    const winLine = winners[0].plainLine ? ` ${winners[0].plainLine}` : '';
    const loseLine = losers[0].plainLine ? ` ${losers[0].plainLine}` : '';
    lines.push(
      `Top: ${winners[0].ticker} ${winners[0].day3Pct != null && winners[0].day3Pct >= 0 ? '+' : ''}${winners[0].day3Pct}% day+3.${winLine}`,
    );
    lines.push(
      `Bottom: ${losers[0].ticker} ${losers[0].day3Pct}% day+3.${loseLine}`,
    );
  }

  return lines;
}

function buildMonth(month: string, prints: MonthlyReportPrint[], threshold: number): MonthlyReportMonth {
  const day3s = prints
    .map((p) => p.day3Pct)
    .filter((v): v is number => v != null && !Number.isNaN(v));
  const passCount = prints.filter((p) => p.badge === 'pass').length;
  const failCount = prints.filter((p) => p.badge === 'fail').length;
  const neutralCount = prints.length - passCount - failCount;
  const sorted = [...prints].sort((a, b) => (b.day3Pct ?? -999) - (a.day3Pct ?? -999));
  const base: Omit<MonthlyReportMonth, 'conclusions'> = {
    month,
    label: monthLabel(month),
    printCount: prints.length,
    passCount,
    failCount,
    neutralCount,
    medianDay3Pct: median(day3s),
    meanDay3Pct: mean(day3s),
    passRatePct: prints.length ? round1((100 * passCount) / prints.length) : null,
    failRatePct: prints.length ? round1((100 * failCount) / prints.length) : null,
    winners: sorted.filter((p) => (p.day3Pct ?? 0) >= threshold).slice(0, 12),
    losers: [...sorted].reverse().filter((p) => (p.day3Pct ?? 0) <= -threshold).slice(0, 12),
    allPrints: sorted,
    byParent: parentStats(prints),
    topTags: topCauseTags(prints),
  };
  return { ...base, conclusions: buildConclusions(base) };
}

export async function loadMonthlyReports(): Promise<MonthlyReportsPayload> {
  const [leaders, badges] = await Promise.all([loadLeadersDashboard(), loadEarningsReactionBadges()]);
  const threshold = badges.thresholdPct ?? 10;
  const { tickers, meta } = leadersTickerMeta(leaders);
  const prints = collectPrints(badges, tickers, meta, threshold);

  const byMonth = new Map<string, MonthlyReportPrint[]>();
  for (const print of prints) {
    const month = String(print.reportDate || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(print);
  }

  const months = [...byMonth.keys()]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => buildMonth(month, byMonth.get(month) || [], threshold));

  const defaultMonth = months[0]?.month ?? null;

  return {
    connected: Boolean(leaders.connected !== false || badges.connected !== false) && months.length > 0,
    generatedAt: badges.generatedAt || leaders.generatedAt,
    asOf: badges.asOf || leaders.asOf,
    thresholdPct: threshold,
    signal: 'day3',
    leadersTickerCount: tickers.size,
    months,
    defaultMonth,
    studyBlurb: badges.studyNote?.blurb,
    method: [
      'Universe: current Leaders roster (+ Trend Scout orphans).',
      'Metric: day+3 reaction vs prior close (settled print), not the gap alone.',
      `PASS+ = day+3 ≥ +${threshold}%; FAIL− = day+3 ≤ −${threshold}%.`,
      'Plain facts: sales/earnings vs prior print and vs Street guidance (consensus estimate). Tags + one-line cause. No adjectives. Not company-issued outlook.',
      'Grouped by report-date month. Conclusions are counts and medians only.',
      'Auto-refreshes with the weekday/charts scanner pipeline (and Leaders upload) — new months fill as prints settle day+3, not only on month-end.',
      ...(badges.method || []).slice(0, 2),
    ],
    message:
      months.length > 0
        ? undefined
        : 'Coming soon — Leaders day+3 history is still warming up. Once prints settle and the reaction badges refresh, monthly PASS+ / FAIL− reports will appear here.',
  };
}
