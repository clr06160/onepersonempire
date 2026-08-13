import type { ChartBar } from '@/lib/charts/load-chart-data';
import { loadChartData } from '@/lib/charts/load-chart-data';
import {
  priorForIndustry,
  type Wave4Prior,
  type Wave4StatusCode,
} from '@/lib/scanner-wave4-rules';

export type Wave4TickerStatus = {
  ticker: string;
  status: Wave4StatusCode;
  priorKey: string;
  priorLabel: string;
  priorMedianPct: number;
  priorAvgPct: number;
  /** % run from ~126d swing low to recent high (or last close if still making highs). */
  runPct: number | null;
  /** How far through the median prior (1.0 = at median). */
  priorProgress: number | null;
  distToHighPct: number | null;
  above10: boolean | null;
  above21: boolean | null;
  above50: boolean | null;
  broke10: boolean;
  broke21: boolean;
  broke50: boolean;
  ext200Pct: number | null;
  asOf: string | null;
  note: string;
};

function smaAt(closes: number[], i: number, n: number): number | null {
  if (i + 1 < n) return null;
  let s = 0;
  for (let j = i + 1 - n; j <= i; j++) s += closes[j];
  return s / n;
}

function computeFromBars(
  ticker: string,
  bars: ChartBar[],
  industry?: string | null,
  sector?: string | null,
): Wave4TickerStatus {
  const prior: Wave4Prior = priorForIndustry(industry, sector);
  const empty: Wave4TickerStatus = {
    ticker,
    status: 'unknown',
    priorKey: prior.key,
    priorLabel: prior.label,
    priorMedianPct: prior.medianMovePct,
    priorAvgPct: prior.avgMovePct,
    runPct: null,
    priorProgress: null,
    distToHighPct: null,
    above10: null,
    above21: null,
    above50: null,
    broke10: false,
    broke21: false,
    broke50: false,
    ext200Pct: null,
    asOf: null,
    note: 'No chart',
  };
  if (!bars || bars.length < 80) return empty;

  const closes = bars.map((b) => b.close);
  const i = bars.length - 1;
  const lookback = Math.min(126, i);
  const window = bars.slice(i - lookback, i + 1);
  const swingLow = Math.min(...window.map((b) => b.low));
  const recentHigh = Math.max(...window.map((b) => b.high));
  const close = closes[i];
  if (!(swingLow > 0) || !(close > 0)) return empty;

  const runPct = ((recentHigh - swingLow) / swingLow) * 100;
  const distToHighPct = ((recentHigh - close) / recentHigh) * 100;
  const priorProgress = prior.medianMovePct > 0 ? runPct / prior.medianMovePct : null;

  const s10 = smaAt(closes, i, 10);
  const s21 = smaAt(closes, i, 21);
  const s50 = smaAt(closes, i, 50);
  const s200 = smaAt(closes, i, 200);
  const p10 = smaAt(closes, i - 1, 10);
  const p21 = smaAt(closes, i - 1, 21);
  const p50 = smaAt(closes, i - 1, 50);

  const above10 = s10 != null ? close > s10 : null;
  const above21 = s21 != null ? close > s21 : null;
  const above50 = s50 != null ? close > s50 : null;

  const broke10 =
    p10 != null && s10 != null && closes[i - 1] >= p10 && close < s10;
  const broke21 =
    p21 != null && s21 != null && closes[i - 1] >= p21 && close < s21;
  const broke50 =
    p50 != null && s50 != null && closes[i - 1] >= p50 && close < s50;

  // Also treat sustained closes below MA as broken (not only the cross day)
  const below10 = above10 === false;
  const below21 = above21 === false;
  const below50 = above50 === false;

  const ext200Pct =
    s200 != null && s200 > 0 ? ((close - s200) / s200) * 100 : null;

  const extended =
    priorProgress != null && priorProgress >= 0.9 && runPct >= prior.medianMovePct * 0.85;
  const softExtended = priorProgress != null && priorProgress >= 0.75;

  let status: Wave4StatusCode = 'riding';
  let note = `Run +${runPct.toFixed(0)}% vs ${prior.label} median +${prior.medianMovePct}% — still room.`;

  if (extended && (below50 || broke50)) {
    status = 'confirmed_wave4';
    note = `Extended (+${runPct.toFixed(0)}%) and lost the 50 — wave 4 confirmed.`;
  } else if (extended && (below10 || below21 || broke10 || broke21)) {
    status = 'about_done';
    note = `Extended (+${runPct.toFixed(0)}%) and broke 10/21 — bank / rotate.`;
  } else if (extended || (softExtended && (ext200Pct ?? 0) >= 30)) {
    status = 'extended';
    note = `At/above prior (+${runPct.toFixed(0)}% vs ~${prior.medianMovePct}%) — tighten trail.`;
  } else if (below21 && below50 && distToHighPct >= 8) {
    status = 'cooling';
    note = `Off highs (${distToHighPct.toFixed(0)}%) without a full extension.`;
  } else if ((ext200Pct ?? 0) >= 40) {
    status = 'extended';
    note = `Stretched +${ext200Pct!.toFixed(0)}% above 200-DMA — danger zone; don’t add.`;
  }

  return {
    ticker,
    status,
    priorKey: prior.key,
    priorLabel: prior.label,
    priorMedianPct: prior.medianMovePct,
    priorAvgPct: prior.avgMovePct,
    runPct: Math.round(runPct * 10) / 10,
    priorProgress: priorProgress != null ? Math.round(priorProgress * 100) / 100 : null,
    distToHighPct: Math.round(distToHighPct * 10) / 10,
    above10,
    above21,
    above50,
    broke10,
    broke21,
    broke50,
    ext200Pct: ext200Pct != null ? Math.round(ext200Pct * 10) / 10 : null,
    asOf: bars[i].time?.slice(0, 10) || null,
    note,
  };
}

export async function computeWave4Status(
  ticker: string,
  industry?: string | null,
  sector?: string | null,
): Promise<Wave4TickerStatus> {
  const chart = await loadChartData(ticker);
  const bars = chart?.bars || [];
  const fund = chart?.fundamentals;
  return computeFromBars(
    ticker.toUpperCase(),
    bars,
    industry ?? fund?.industry,
    sector ?? fund?.sector,
  );
}

export async function computeWave4StatusMap(
  tickers: string[],
  metaByTicker?: Record<string, { industry?: string | null; sector?: string | null }>,
  concurrency = 8,
): Promise<Record<string, Wave4TickerStatus>> {
  const unique = [...new Set(tickers.map((t) => t.toUpperCase()).filter(Boolean))];
  const out: Record<string, Wave4TickerStatus> = {};
  let idx = 0;

  async function worker() {
    while (idx < unique.length) {
      const my = idx++;
      const t = unique[my];
      const meta = metaByTicker?.[t];
      try {
        out[t] = await computeWave4Status(t, meta?.industry, meta?.sector);
      } catch {
        out[t] = {
          ticker: t,
          status: 'unknown',
          priorKey: 'default',
          priorLabel: 'Market default',
          priorMedianPct: 24,
          priorAvgPct: 36,
          runPct: null,
          priorProgress: null,
          distToHighPct: null,
          above10: null,
          above21: null,
          above50: null,
          broke10: false,
          broke21: false,
          broke50: false,
          ext200Pct: null,
          asOf: null,
          note: 'Chart unavailable',
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(workers);
  return out;
}
