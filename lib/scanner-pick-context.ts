import type { EarningsCalendarPayload } from '@/lib/scanner-earnings-data';
import { loadEarningsCalendarData } from '@/lib/scanner-earnings-data';
import type { CatalystPayload, CatalystThemeSummary } from '@/lib/scanner-catalysts-data';
import { loadScannerCatalystsData } from '@/lib/scanner-catalysts-data';
import { loadScannerFlowData } from '@/lib/scanner-flow-data';
import type { ShortlistDisqualifiedRow, ShortlistPayload, ShortlistRow } from '@/lib/scanner-shortlist-data';
import { loadScannerShortlistData } from '@/lib/scanner-shortlist-data';
import type { ValuationRow } from '@/lib/scanner-valuations-data';
import { loadScannerValuationsData } from '@/lib/scanner-valuations-data';

export type PickEarningsContext = {
  earningsDate: string;
  threeDayReactionPct?: number | null;
  immediateReactionPct?: number | null;
  earningsReactionScore?: number | null;
};

export type PickThemeContext = {
  label: string;
  direction?: string;
  stage?: string;
  caution?: boolean;
  kind?: 'theme' | 'sector';
};

export type PickContext = {
  ticker: string;
  company?: string;
  sector?: string;
  industry?: string;
  animal?: string;
  runwayScore?: number | null;
  musicStopsRisk?: number | null;
  flowSignal?: string;
  sixWeekSetupScore?: number | null;
  shortlistRank?: number | null;
  inTopTenBook?: boolean;
  theme?: PickThemeContext;
  vetoReasons: string[];
  vetoed: boolean;
  earnings?: PickEarningsContext;
};

export type LensForwardSnapshot = {
  label: string;
  href: string;
  equity?: number | null;
  totalReturnPct?: number | null;
  asOf?: string;
  note?: string;
};

export type PickContextPayload = {
  connected: boolean;
  generatedAt?: string;
  byTicker: Record<string, PickContext>;
  lenses: LensForwardSnapshot[];
  message?: string;
};

const VETO_ANIMALS = new Set(['Bear', 'Canary']);
const THEME_VETO_DIRECTIONS = new Set(['Rotating Out', 'Down']);

const THEME_DIRECTION_RANK: Record<string, number> = {
  'Rotating Out': 0,
  Down: 1,
  Mixed: 2,
  Up: 3,
  'Rotating In': 4,
};

function themeIsVeto(direction?: string, stage?: string): boolean {
  const normalized = direction || 'Mixed';
  if (THEME_VETO_DIRECTIONS.has(normalized)) return true;
  return stage === 'Fading' && normalized !== 'Rotating In' && normalized !== 'Up';
}

function themeDirectionRank(direction?: string): number {
  return THEME_DIRECTION_RANK[direction || 'Mixed'] ?? 2;
}

function themeIsWorse(candidate: CatalystThemeSummary, current: CatalystThemeSummary): boolean {
  const candidateRank = themeDirectionRank(candidate.direction);
  const currentRank = themeDirectionRank(current.direction);
  if (candidateRank !== currentRank) return candidateRank < currentRank;
  if (candidate.stage === 'Fading' && current.stage !== 'Fading') return true;
  return false;
}

function buildTickerThemeMap(catalysts: CatalystPayload): Record<string, PickThemeContext> {
  const themeMap = new Map((catalysts.themes || []).map((theme) => [theme.key, theme]));
  const out: Record<string, PickThemeContext> = {};

  for (const row of catalysts.rows || []) {
    const ticker = String(row.ticker || '').toUpperCase();
    if (!ticker) continue;

    let worst: CatalystThemeSummary | null = null;
    for (const hit of row.themes || []) {
      const summary = themeMap.get(hit.key);
      if (!summary) continue;
      if (!worst || themeIsWorse(summary, worst)) worst = summary;
    }
    if (!worst) continue;

    const direction = worst.direction || 'Mixed';
    const stage = worst.stage || 'Mixed';
    out[ticker] = {
      label: worst.label || worst.key,
      direction,
      stage,
      caution: stage === 'Crowded' && !themeIsVeto(direction, stage),
      kind: 'theme',
    };
  }

  return out;
}

function computeVetoReasons({
  animal,
  musicStopsRisk,
  flowSignal,
  theme,
}: {
  animal?: string;
  musicStopsRisk?: number | null;
  flowSignal?: string;
  theme?: PickThemeContext;
}): string[] {
  const reasons: string[] = [];
  if (animal && VETO_ANIMALS.has(animal)) reasons.push(`${animal} animal`);
  if (musicStopsRisk != null && musicStopsRisk >= 78) reasons.push(`Music stops ${Math.round(musicStopsRisk)}`);
  if (String(flowSignal || '').toUpperCase() === 'DISTRIBUTING') reasons.push('Distributing flow');
  if (theme && themeIsVeto(theme.direction, theme.stage)) {
    reasons.push(`Theme: ${theme.label} (${theme.direction})`);
  }
  return reasons;
}

function vetoReasonsFromRow(row: ShortlistRow | ShortlistDisqualifiedRow, theme?: PickThemeContext): string[] {
  if ('reasons' in row && row.reasons?.length) {
    return row.reasons;
  }
  return computeVetoReasons({
    animal: row.animal?.animal,
    musicStopsRisk: row.musicStopsRisk,
    flowSignal: row.flowSignal,
    theme,
  });
}

function rowToContext(
  row: ShortlistRow | ShortlistDisqualifiedRow,
  earnings?: PickEarningsContext,
  theme?: PickThemeContext,
): PickContext {
  return contextFromFields({
    ticker: row.ticker,
    company: row.company,
    animal: row.animal?.animal,
    runwayScore: row.runwayScore,
    musicStopsRisk: row.musicStopsRisk,
    flowSignal: row.flowSignal,
    sixWeekSetupScore: row.sixWeekSetupScore,
    shortlistRank: row.rank,
    inTopTenBook: row.inTopTenBook,
    theme,
    vetoReasons: vetoReasonsFromRow(row, theme),
    earnings,
  });
}

function contextFromFields(fields: {
  ticker: string;
  company?: string;
  sector?: string;
  industry?: string;
  animal?: string;
  runwayScore?: number | null;
  musicStopsRisk?: number | null;
  flowSignal?: string;
  sixWeekSetupScore?: number | null;
  shortlistRank?: number | null;
  inTopTenBook?: boolean;
  theme?: PickThemeContext;
  vetoReasons?: string[];
  earnings?: PickEarningsContext;
}): PickContext {
  const vetoReasons =
    fields.vetoReasons ??
    computeVetoReasons({
      animal: fields.animal,
      musicStopsRisk: fields.musicStopsRisk,
      flowSignal: fields.flowSignal,
      theme: fields.theme,
    });
  return {
    ticker: fields.ticker,
    company: fields.company,
    sector: fields.sector,
    industry: fields.industry,
    animal: fields.animal,
    runwayScore: fields.runwayScore,
    musicStopsRisk: fields.musicStopsRisk,
    flowSignal: fields.flowSignal,
    sixWeekSetupScore: fields.sixWeekSetupScore,
    shortlistRank: fields.shortlistRank,
    inTopTenBook: fields.inTopTenBook,
    theme: fields.theme,
    vetoReasons,
    vetoed: vetoReasons.length > 0,
    earnings: fields.earnings,
  };
}

function applyTheme(ctx: PickContext, theme?: PickThemeContext): PickContext {
  if (!theme) return ctx;
  const vetoReasons = computeVetoReasons({
    animal: ctx.animal,
    musicStopsRisk: ctx.musicStopsRisk,
    flowSignal: ctx.flowSignal,
    theme,
  });
  return { ...ctx, theme, vetoReasons, vetoed: vetoReasons.length > 0 };
}

function valuationRowToContext(
  row: ValuationRow,
  flowSignal?: string,
  earnings?: PickEarningsContext,
  theme?: PickThemeContext,
): PickContext {
  return contextFromFields({
    ticker: row.ticker,
    company: row.company,
    animal: row.animal?.animal,
    runwayScore: row.scores?.runwayScore,
    musicStopsRisk: row.scores?.musicStopsRisk,
    flowSignal,
    sixWeekSetupScore: row.scores?.sixWeekSetupScore,
    theme,
    earnings,
  });
}

async function mergeValuationFlowFallback(
  byTicker: Record<string, PickContext>,
  earningsMap: Record<string, PickEarningsContext>,
  themeMap: Record<string, PickThemeContext>,
) {
  const [valuations, flow] = await Promise.all([
    loadScannerValuationsData().catch(() => null),
    loadScannerFlowData().catch(() => null),
  ]);
  const flowTickers = flow?.tickers || {};

  for (const row of valuations?.rows || []) {
    const ticker = String(row.ticker || '').toUpperCase();
    if (!ticker) continue;
    const existing = byTicker[ticker];
    const flowSignal = flowTickers[ticker]?.signal || existing?.flowSignal;
    const theme = themeMap[ticker] || existing?.theme;
    const merged = valuationRowToContext(row, flowSignal, earningsMap[ticker] || existing?.earnings, theme);
    byTicker[ticker] = {
      ...merged,
      shortlistRank: existing?.shortlistRank ?? merged.shortlistRank,
      inTopTenBook: existing?.inTopTenBook ?? merged.inTopTenBook,
    };
  }

  for (const [ticker, flowRow] of Object.entries(flowTickers)) {
    const key = ticker.toUpperCase();
    const existing = byTicker[key];
    if (!existing) {
      byTicker[key] = contextFromFields({
        ticker: key,
        flowSignal: flowRow.signal,
        theme: themeMap[key],
        earnings: earningsMap[key],
      });
      continue;
    }
    if (existing.flowSignal && existing.theme) continue;
    const flowSignal = existing.flowSignal || flowRow.signal;
    const theme = existing.theme || themeMap[key];
    byTicker[key] = applyTheme(
      { ...existing, flowSignal },
      theme,
    );
  }
}

function mergeThemeContext(byTicker: Record<string, PickContext>, themeMap: Record<string, PickThemeContext>) {
  for (const [ticker, theme] of Object.entries(themeMap)) {
    const existing = byTicker[ticker];
    if (!existing) {
      byTicker[ticker] = contextFromFields({ ticker, theme });
      continue;
    }
    byTicker[ticker] = applyTheme(existing, theme);
  }
}

function mergeSectorFallback(byTicker: Record<string, PickContext>, catalysts: CatalystPayload) {
  for (const row of catalysts.rows || []) {
    const ticker = String(row.ticker || '').toUpperCase();
    if (!ticker) continue;
    const existing = byTicker[ticker];
    const sector = String(row.sector || '').trim();
    const industry = String(row.industry || '').trim();
    if (!existing) {
      byTicker[ticker] = contextFromFields({ ticker, sector, industry });
      continue;
    }
    byTicker[ticker] = {
      ...existing,
      sector: existing.sector || sector || undefined,
      industry: existing.industry || industry || undefined,
      company: existing.company || row.company,
    };
  }
}

function earningsByTicker(calendar: EarningsCalendarPayload): Record<string, PickEarningsContext> {
  const out: Record<string, PickEarningsContext> = {};
  for (const day of calendar.days || []) {
    for (const stock of day.stocks || []) {
      const ticker = String(stock.ticker || '').toUpperCase();
      if (!ticker || out[ticker]) continue;
      out[ticker] = {
        earningsDate: stock.earningsDate || day.date,
        threeDayReactionPct: stock.threeDayReactionPct,
        immediateReactionPct: stock.immediateReactionPct,
        earningsReactionScore: stock.earningsReactionScore,
      };
    }
  }
  return out;
}

function lensSnapshots(shortlist: ShortlistPayload, calendar: EarningsCalendarPayload): LensForwardSnapshot[] {
  const lenses: LensForwardSnapshot[] = [];

  const topTen = shortlist.forwardTest;
  if (topTen?.equity != null || topTen?.totalReturnPct != null) {
    lenses.push({
      label: 'Top Ten paper',
      href: '/scanner/top-ten',
      equity: topTen.equity,
      totalReturnPct: topTen.totalReturnPct,
      asOf: topTen.asOf || shortlist.asOf,
    });
  }

  const earningsLive = calendar.forwardTest?.live;
  if (earningsLive?.equity != null || earningsLive?.totalReturnPct != null) {
    lenses.push({
      label: 'Earnings paper',
      href: '/scanner/calendar',
      equity: earningsLive.equity,
      totalReturnPct: earningsLive.totalReturnPct,
      asOf: earningsLive.asOf || calendar.asOf,
    });
  }

  return lenses;
}

export async function loadPickContextPayload(): Promise<PickContextPayload> {
  const [shortlist, calendar, catalysts] = await Promise.all([
    loadScannerShortlistData(),
    loadEarningsCalendarData(),
    loadScannerCatalystsData().catch(() => ({ rows: [], themes: [] } as CatalystPayload)),
  ]);
  const earningsMap = earningsByTicker(calendar);
  const themeMap = buildTickerThemeMap(catalysts);
  const byTicker: Record<string, PickContext> = {};

  const allRows: (ShortlistRow | ShortlistDisqualifiedRow)[] = [
    ...(shortlist.rows || []),
    ...(shortlist.disqualified || []),
  ];

  for (const row of allRows) {
    const ticker = String(row.ticker || '').toUpperCase();
    if (!ticker) continue;
    byTicker[ticker] = rowToContext(row, earningsMap[ticker], themeMap[ticker]);
  }

  for (const [ticker, earnings] of Object.entries(earningsMap)) {
    if (byTicker[ticker]) continue;
    byTicker[ticker] = contextFromFields({
      ticker,
      vetoReasons: [],
      earnings,
    });
  }

  await mergeValuationFlowFallback(byTicker, earningsMap, themeMap);
  mergeThemeContext(byTicker, themeMap);
  mergeSectorFallback(byTicker, catalysts);

  const topTenHoldings = new Set(
    (shortlist.forwardTest?.holdings || shortlist.portfolio?.map((row) => row.ticker) || []).map((t) =>
      String(t).toUpperCase(),
    ),
  );
  for (const ticker of topTenHoldings) {
    if (!byTicker[ticker]) continue;
    byTicker[ticker] = { ...byTicker[ticker], inTopTenBook: true };
  }

  const connected = Boolean(shortlist.connected || calendar.connected || catalysts.connected);
  return {
    connected,
    generatedAt: shortlist.generatedAt || calendar.generatedAt,
    byTicker,
    lenses: lensSnapshots(shortlist, calendar),
    message: connected
      ? undefined
      : shortlist.message || calendar.message || 'Pick context not available yet.',
  };
}
