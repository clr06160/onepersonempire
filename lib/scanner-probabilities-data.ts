import { nextUpcomingMeeting, rateLean } from '@/lib/fedwatch-utils';
import { loadCotReportData } from '@/lib/scanner-cot-data';
import { loadCupHandleData } from '@/lib/scanner-cup-handle-data';
import { loadScannerData } from '@/lib/scanner-data';
import { loadScannerDayTradeData } from '@/lib/scanner-daytrade-data';
import { loadEarningsCalendarData } from '@/lib/scanner-earnings-data';
import { loadElliottWaveDashboard } from '@/lib/scanner-elliott-wave-data';
import { loadFedWatchData } from '@/lib/scanner-fedwatch-data';
import { loadPeGlassDashboard } from '@/lib/scanner-pe-glass-data';
import { loadRawBearDashboard } from '@/lib/scanner-raw-bear-data';
import { loadScannerShortlistData } from '@/lib/scanner-shortlist-data';
import { loadScannerValuationsData } from '@/lib/scanner-valuations-data';

export type ProbabilityKind =
  | 'model'
  | 'hitRate'
  | 'marketOdds'
  | 'heuristic'
  | 'tongueInCheek';

export type ProbabilityTone = 'ok' | 'warn' | 'hot' | 'cold' | 'neutral';

export type ProbabilityCard = {
  id: string;
  title: string;
  group: string;
  kind: ProbabilityKind;
  /** Primary display number in percent terms when available. */
  valuePct: number | null;
  display: string;
  subtitle: string;
  detail: string;
  caveat: string;
  href?: string;
  sampleSize?: number | null;
  asOf?: string | null;
  tone: ProbabilityTone;
  secondary?: { label: string; display: string }[];
};

export type ProbabilitiesPayload = {
  connected: boolean;
  generatedAt: string;
  sourceCount: number;
  missingSources: string[];
  note: string;
  cards: ProbabilityCard[];
  message?: string;
};

type GlobalRegime = {
  regimeLabel?: string;
  regimeScale?: number;
  painProbPct?: string;
  painProb60dPct?: string;
  regimeReason?: string;
  regimeAsOf?: string;
  backtestCagr?: string;
  backtestMaxDd?: string;
  backtestCalmar?: string;
  backtestWindow?: string;
  footerTitle?: string;
};

function parsePct(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/%/g, '').trim();
  if (!cleaned || cleaned === 'n/a') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

function fmtProb(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

function toneForProbHighIsBad(n: number | null): ProbabilityTone {
  if (n == null) return 'neutral';
  if (n >= 50) return 'hot';
  if (n >= 25) return 'warn';
  return 'ok';
}

function toneForHitRate(n: number | null): ProbabilityTone {
  if (n == null) return 'neutral';
  if (n >= 60) return 'ok';
  if (n >= 45) return 'neutral';
  return 'warn';
}

function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function richSurvivalStory(cagrPct: number | null, maxDdPct: number | null): {
  valuePct: number | null;
  display: string;
  detail: string;
} {
  // Tongue-in-cheek: approximate "stay invested through max DD" as a rough survival score.
  // Not a real probability model — just a sanity check against CAGR fantasies.
  if (cagrPct == null || maxDdPct == null) {
    return {
      valuePct: null,
      display: '—',
      detail: 'Need Core + learned-pain backtest CAGR and max drawdown to sketch this joke card.',
    };
  }
  const ddAbs = Math.abs(maxDdPct);
  // Soft curve: −20% DD → ~70, −40% → ~45, −60% → ~28
  const stayInvested = Math.max(8, Math.min(85, 100 * Math.exp(-ddAbs / 45)));
  // "Get rich" needs both edge and not quitting — blend CAGR attractiveness with survival.
  const edgeScore = Math.max(0, Math.min(100, (cagrPct / 30) * 55));
  const richish = Math.round(0.45 * edgeScore + 0.55 * stayInvested);
  return {
    valuePct: richish,
    display: `~${richish}%`,
    detail: `Joke estimate from Core paper path: ~${cagrPct.toFixed(1)}% CAGR with ~${maxDdPct.toFixed(1)}% max DD. Edge helps; surviving a ~${ddAbs.toFixed(0)}% hole is the real filter.`,
  };
}

export async function loadProbabilitiesPayload(): Promise<ProbabilitiesPayload> {
  const results = await Promise.allSettled([
    loadScannerData(),
    loadScannerDayTradeData(),
    loadCotReportData(),
    loadRawBearDashboard(),
    loadPeGlassDashboard(),
    loadScannerShortlistData(),
    loadEarningsCalendarData(),
    loadFedWatchData(),
    loadElliottWaveDashboard(),
    loadCupHandleData(),
    loadScannerValuationsData(),
  ]);

  const labels = [
    'scanner',
    'daytrade',
    'cot',
    'rawBear',
    'peGlass',
    'shortlist',
    'earnings',
    'fedwatch',
    'elliott',
    'cupHandle',
    'valuations',
  ];
  const missingSources = results
    .map((r, i) => (r.status === 'rejected' ? labels[i] : null))
    .filter((x): x is string => Boolean(x));

  const scanner = settledValue(results[0]) as
    | (Awaited<ReturnType<typeof loadScannerData>> & { globalRegime?: GlobalRegime })
    | null;
  const daytrade = settledValue(results[1]);
  const cot = settledValue(results[2]);
  const rawBear = settledValue(results[3]);
  const peGlass = settledValue(results[4]);
  const shortlist = settledValue(results[5]);
  const earnings = settledValue(results[6]);
  const fedwatch = settledValue(results[7]);
  const elliott = settledValue(results[8]);
  const cupHandle = settledValue(results[9]);
  const valuations = settledValue(results[10]);

  const cards: ProbabilityCard[] = [];
  const regime = scanner?.globalRegime;
  const pain20 =
    parsePct(regime?.painProbPct) ?? parsePct(daytrade?.learnedPain?.painProb20dPct);
  const pain60 =
    parsePct(regime?.painProb60dPct) ?? parsePct(daytrade?.learnedPain?.painProb60dPct);
  const regimeLabel = regime?.regimeLabel || daytrade?.learnedPain?.badge || null;
  const scalePct =
    regime?.regimeScale != null
      ? Math.round(regime.regimeScale * 100)
      : daytrade?.learnedPain?.scalePct ?? null;

  if (pain20 != null || regimeLabel) {
    cards.push({
      id: 'pain-20d',
      title: 'Core pain risk (20 days)',
      group: 'Book regime',
      kind: 'model',
      valuePct: pain20,
      display: fmtProb(pain20),
      subtitle: 'Model P(core book ≤ −8% within ~20 sessions)',
      detail:
        daytrade?.learnedPain?.reason ||
        regime?.regimeReason ||
        'Logistic model on ledger features — forward chance of another ugly drop, not “how down are we now.”',
      caveat: 'Calibrated on a short history. Low pain ≠ bullish; it means another −8% looks unlikely soon.',
      href: '/scanner/daytrade',
      asOf: regime?.regimeAsOf || daytrade?.learnedPain?.asOf || null,
      tone: toneForProbHighIsBad(pain20),
      secondary: [
        { label: 'Book mode', display: regimeLabel || '—' },
        { label: 'Size scale', display: scalePct != null ? `${scalePct}%` : '—' },
      ],
    });
  }

  if (pain60 != null) {
    cards.push({
      id: 'pain-60d',
      title: 'Core pain risk (60 days)',
      group: 'Book regime',
      kind: 'model',
      valuePct: pain60,
      display: fmtProb(pain60),
      subtitle: 'Model P(core ≤ −15% within ~60 sessions)',
      detail: 'Same learned-pain model, longer horizon / deeper threshold.',
      caveat: 'Still a model estimate — not a guarantee of safety or doom.',
      href: '/scanner/daytrade',
      asOf: regime?.regimeAsOf || daytrade?.learnedPain?.asOf || null,
      tone: toneForProbHighIsBad(pain60),
    });
  }

  // Daytrade historical win rates — prefer SOXL crash-close if present
  const histPairs = daytrade?.historicalStats?.pairs || [];
  const soxl = histPairs.find((p) => p.bull === 'SOXL') || histPairs[0];
  if (soxl?.crashClose?.sameDayClose?.winRatePct != null) {
    const closeWr = soxl.crashClose.sameDayClose.winRatePct;
    const highWr = soxl.crashClose.sameDayHigh?.winRatePct ?? null;
    cards.push({
      id: 'bounce-close',
      title: `${soxl.bull} bounce: hold to close`,
      group: 'Day trade',
      kind: 'hitRate',
      valuePct: closeWr,
      display: fmtProb(closeWr),
      subtitle: 'Historical win rate — crash-close entry, bounce-day close green',
      detail: `n≈${soxl.crashClose.count ?? soxl.signalCount ?? '?'} signals. Avg close move ${fmtPct(soxl.crashClose.sameDayClose.avgPct)}.`,
      caveat: 'Past bounce days after 3× crashes — not a promise for the next flush.',
      href: '/scanner/daytrade',
      sampleSize: soxl.crashClose.count ?? soxl.signalCount ?? null,
      tone: toneForHitRate(closeWr),
      secondary:
        highWr != null
          ? [
              { label: 'Scalp high WR', display: fmtProb(highWr) },
              {
                label: 'Lesson',
                display: highWr - closeWr > 5 ? 'High ≫ close (fade the rip)' : 'Similar',
              },
            ]
          : undefined,
    });
  }

  const tierPair = daytrade?.bounceTierBacktest?.pairs?.find((p) => p.ticker === 'SOXL') ||
    daytrade?.bounceTierBacktest?.pairs?.[0];
  const strong = tierPair?.tiers?.STRONG_gapUpOpen || tierPair?.tiers?.STRONG;
  const standard = tierPair?.tiers?.STANDARD_flatOrDownOpen || tierPair?.tiers?.STANDARD;
  if (strong?.winRatePct != null && standard?.winRatePct != null) {
    const delta = strong.winRatePct - standard.winRatePct;
    cards.push({
      id: 'bounce-strong-vs-standard',
      title: `${tierPair?.ticker || '3×'} STRONG vs STANDARD`,
      group: 'Day trade',
      kind: 'hitRate',
      valuePct: strong.winRatePct,
      display: fmtProb(strong.winRatePct),
      subtitle: `Gap-up open tier win rate (vs STANDARD ${fmtProb(standard.winRatePct)})`,
      detail: `Delta ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp. STRONG = overnight gap-up after crash entry.`,
      caveat: 'Tier split is historical; live overnight open decides the bucket.',
      href: '/scanner/daytrade',
      sampleSize: strong.count ?? null,
      tone: toneForHitRate(strong.winRatePct),
      secondary: [
        { label: 'STANDARD WR', display: fmtProb(standard.winRatePct) },
        { label: 'Delta', display: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp` },
      ],
    });
  }

  // COT sleeves
  for (const sleeve of cot?.forwardTest?.sleeves || []) {
    const hit = sleeve.summary?.hitRatePct ?? sleeve.weeklySummary?.hitRatePct ?? null;
    const total = sleeve.summary?.totalReturnPct ?? null;
    cards.push({
      id: `cot-${sleeve.key}`,
      title: `COT ${sleeve.label} weekly hit`,
      group: 'COT paper',
      kind: 'hitRate',
      valuePct: hit,
      display: fmtProb(hit),
      subtitle: 'Share of weeks the paper sleeve finished green',
      detail: `Total ${fmtPct(total)} over ${sleeve.summary?.periodCount ?? '—'} weeks. Hit rate ≠ return.`,
      caveat: 'Educational paper test on 1× ETFs. Crowds can be short and wrong.',
      href: '/scanner/cot',
      sampleSize: sleeve.summary?.periodCount ?? null,
      asOf: cot?.forwardTest?.reportDate || cot?.reportDate || null,
      tone: toneForHitRate(hit),
      secondary: [{ label: 'Total return', display: fmtPct(total) }],
    });
  }

  // Specs currently short? — stance probability-ish framing
  const shortCharts = (cot?.charts || []).filter((c) => (c.stance || c.signal) === 'SHORT');
  if (cot?.charts?.length) {
    const pctShort = (shortCharts.length / cot.charts.length) * 100;
    cards.push({
      id: 'cot-crowd-short',
      title: 'Specs net short (map)',
      group: 'COT paper',
      kind: 'heuristic',
      valuePct: pctShort,
      display: `${shortCharts.length}/${cot.charts.length}`,
      subtitle: 'Share of tracked markets where leveraged/managed money is net short',
      detail: shortCharts.length
        ? `Short now: ${shortCharts.map((c) => c.label.replace(/\s*\(.*\)/, '')).join(', ')}.`
        : 'No tracked markets are net short this week.',
      caveat: 'Positioning map — not “probability they are right.”',
      href: '/scanner/cot',
      asOf: cot.reportDate || null,
      tone: pctShort >= 50 ? 'warn' : 'neutral',
    });
  }

  const bearOverall =
    rawBear?.forwardTest?.universes?.find((u) => u.key === 'overall') ||
    rawBear?.forwardTest?.universes?.[0];
  if (bearOverall?.summary?.hitRatePct != null) {
    cards.push({
      id: 'raw-bear-hit',
      title: 'Raw bear short-radar hit',
      group: 'Defense',
      kind: 'hitRate',
      valuePct: bearOverall.summary.hitRatePct,
      display: fmtProb(bearOverall.summary.hitRatePct),
      subtitle: 'Paper weeks where simulated short of weak names worked',
      detail: `Total ${fmtPct(bearOverall.summary.totalReturnPct)} · ${bearOverall.summary.periodCount ?? '—'} periods. Radar for hedges — not IRA shorts.`,
      caveat: 'Laggards can squeeze. Hit rate can look fine while total return hurts.',
      href: '/scanner/raw-bear',
      sampleSize: bearOverall.summary.periodCount ?? null,
      asOf: rawBear?.forwardTest?.asOf || rawBear?.asOf || null,
      tone: toneForHitRate(bearOverall.summary.hitRatePct),
      secondary: [{ label: 'Total', display: fmtPct(bearOverall.summary.totalReturnPct) }],
    });
  }

  const peBest =
    peGlass?.backtest?.bestBucket ||
    peGlass?.backtest?.buckets?.slice().sort((a, b) => (b.hitRatePct ?? 0) - (a.hitRatePct ?? 0))[0];
  if (peBest?.hitRatePct != null) {
    cards.push({
      id: 'pe-glass-best',
      title: `Earnings glass: ${peBest.label || peBest.key || 'best bucket'}`,
      group: 'Earnings glass',
      kind: 'hitRate',
      valuePct: peBest.hitRatePct,
      display: fmtProb(peBest.hitRatePct),
      subtitle: 'Historical monthly hit rate for the standout PE-glass bucket',
      detail: `CAGR ${fmtPct(peBest.cagrPct)} · max DD ${fmtPct(peBest.maxDrawdownPct)} · n=${peBest.periodCount ?? '—'}`,
      caveat: 'Backtest edge with ugly drawdowns. Hit rate alone is not “easy money.”',
      href: '/scanner/earnings-glass',
      sampleSize: peBest.periodCount ?? null,
      asOf: peGlass?.backtest?.asOf || null,
      tone: toneForHitRate(peBest.hitRatePct),
      secondary: [
        { label: 'CAGR', display: fmtPct(peBest.cagrPct) },
        { label: 'Max DD', display: fmtPct(peBest.maxDrawdownPct) },
      ],
    });
  }

  const peFwd = peGlass?.forwardTest?.buckets?.find((b) => (b.summary?.periodCount ?? 0) > 0);
  if (peFwd?.summary?.hitRatePct != null) {
    cards.push({
      id: 'pe-glass-live',
      title: `Glass live: ${peFwd.label || peFwd.key}`,
      group: 'Earnings glass',
      kind: 'hitRate',
      valuePct: peFwd.summary.hitRatePct,
      display: fmtProb(peFwd.summary.hitRatePct),
      subtitle: 'Thin live forward-test hit rate (still warming up)',
      detail: `Total ${fmtPct(peFwd.summary.totalReturnPct)} · ${peFwd.summary.periodCount} periods`,
      caveat: 'Small sample — treat as a seedling ledger, not a verdict.',
      href: '/scanner/earnings-glass',
      sampleSize: peFwd.summary.periodCount ?? null,
      tone: toneForHitRate(peFwd.summary.hitRatePct),
    });
  }

  const shortClosed = shortlist?.forwardTest?.closedSummary?.hitRatePct;
  if (shortClosed != null) {
    cards.push({
      id: 'top-ten-closed',
      title: 'Top Ten closed-trade hit',
      group: 'Top Ten',
      kind: 'hitRate',
      valuePct: shortClosed,
      display: fmtProb(shortClosed),
      subtitle: 'Share of closed Top Ten book turns that finished green',
      detail: `Open hit ${fmtProb(shortlist?.forwardTest?.openSummary?.hitRatePct)} · book total ${fmtPct(shortlist?.forwardTest?.totalReturnPct)} · max DD ${fmtPct(shortlist?.forwardTest?.maxDrawdownPct)}`,
      caveat: 'Young paper ledger; n can be small.',
      href: '/scanner/top-ten',
      sampleSize: shortlist?.forwardTest?.closedSummary?.count ?? null,
      asOf: shortlist?.forwardTest?.asOf || null,
      tone: toneForHitRate(shortClosed),
    });
  }

  const earnLive = earnings?.forwardTest?.live;
  if (earnLive?.hitRatePct != null) {
    cards.push({
      id: 'earnings-reactor',
      title: 'Earnings reactor hit',
      group: 'Earnings calendar',
      kind: 'hitRate',
      valuePct: earnLive.hitRatePct,
      display: fmtProb(earnLive.hitRatePct),
      subtitle: 'Paper trades around report dates (ATR stop rules)',
      detail: `Avg ${fmtPct(earnLive.avgReturnPct)} · closed ${earnLive.closedCount ?? '—'} · equity ${earnLive.equity != null ? Math.round(earnLive.equity).toLocaleString() : '—'}`,
      caveat: 'Qualifier calendar ≠ free money on every print.',
      href: '/scanner/calendar',
      sampleSize: earnLive.closedCount ?? null,
      tone: toneForHitRate(earnLive.hitRatePct),
    });
  }

  const valGroups = valuations?.forwardTest?.groups || [];
  const valBest = valGroups
    .map((g) => ({
      label: g.label || g.key || 'group',
      hit: g.combined?.hitRatePct ?? g.closed?.hitRatePct ?? g.open?.hitRatePct ?? null,
      n: g.combined?.count ?? g.closed?.count ?? g.open?.count ?? null,
    }))
    .filter((g) => g.hit != null)
    .sort((a, b) => (b.hit ?? 0) - (a.hit ?? 0))[0];
  if (valBest?.hit != null) {
    cards.push({
      id: 'valuations-best',
      title: `Valuations: ${valBest.label}`,
      group: 'Valuations',
      kind: 'hitRate',
      valuePct: valBest.hit,
      display: fmtProb(valBest.hit),
      subtitle: 'Best animal/runway bucket hit rate in the live membership test',
      detail: `n=${valBest.n ?? '—'} turns while names sat in that bucket.`,
      caveat: 'Bucket membership changes; this is not a static stock pick list.',
      href: '/scanner/valuations',
      sampleSize: valBest.n,
      tone: toneForHitRate(valBest.hit),
    });
  }

  const meeting = nextUpcomingMeeting(fedwatch || undefined);
  const lean = rateLean(meeting);
  if (lean) {
    cards.push({
      id: 'fed-next',
      title: `Fed next meeting: ${lean.label}`,
      group: 'Macro odds',
      kind: 'marketOdds',
      valuePct: lean.prob,
      display: fmtProb(lean.prob),
      subtitle: `CME FedWatch lean for ${meeting?.meetingDate || 'upcoming FOMC'}`,
      detail: `Hold ${fmtProb(meeting?.probabilities?.hold)} · cut ${fmtProb(meeting?.probabilities?.cut25)} · hike ${fmtProb(meeting?.probabilities?.hike25)}`,
      caveat: 'Market-implied futures odds — can swing hard into the meeting.',
      href: '/scanner/fedwatch',
      asOf: fedwatch?.generatedAt?.slice(0, 10) || null,
      tone: lean.tone === 'hold' ? 'neutral' : lean.tone === 'cut' ? 'ok' : 'warn',
    });
  }

  const ewMarket =
    elliott?.markets?.find((m) => /nasdaq|qqq|ndx/i.test(`${m.ticker || ''} ${m.label || ''}`)) ||
    elliott?.markets?.[0];
  if (ewMarket?.probabilities?.probHighFirst != null || ewMarket?.probabilities?.probLowFirst != null) {
    const highPct = ewMarket.probabilities.probHighFirst ?? 0;
    const lowPct = ewMarket.probabilities.probLowFirst ?? 0;
    const primary = highPct >= lowPct ? highPct : lowPct;
    const primaryLabel = highPct >= lowPct ? 'high first' : 'low first';
    cards.push({
      id: 'elliott-path',
      title: `Elliott: ${ewMarket.label || ewMarket.ticker} ${primaryLabel}`,
      group: 'Macro odds',
      kind: 'heuristic',
      valuePct: primary,
      display: fmtProb(primary),
      subtitle: 'Structured guess which target prints first',
      detail: `High-first ${fmtProb(highPct)} · low-first ${fmtProb(lowPct)} · confidence ${ewMarket.probabilities.confidence || 'n/a'}`,
      caveat: 'Heuristic wave odds — keep confidence honest (often low).',
      href: '/scanner/elliott-wave',
      tone: 'neutral',
      secondary: [{ label: 'Likely first', display: String(ewMarket.probabilities.likelyFirst || primaryLabel) }],
    });
  }

  const cupBest = (cupHandle?.universes || [])
    .filter((u) => u.winRatePct != null)
    .sort((a, b) => (b.winRatePct ?? 0) - (a.winRatePct ?? 0))[0];
  if (cupBest?.winRatePct != null) {
    cards.push({
      id: 'cup-handle',
      title: `Cup & handle: ${cupBest.label}`,
      group: 'Patterns',
      kind: 'hitRate',
      valuePct: cupBest.winRatePct,
      display: fmtProb(cupBest.winRatePct),
      subtitle: 'Mechanical breakout win rate vs buy-and-hold reality check',
      detail: `Strategy CAGR ${fmtPct(cupBest.strategyCagrPct)} vs bench ${fmtPct(cupBest.benchCagrPct)} · PF ${cupBest.profitFactor?.toFixed?.(2) ?? cupBest.profitFactor ?? '—'} · n=${cupBest.trades ?? '—'}`,
      caveat: 'Win rate can look fine while the index still wins the CAGR race.',
      href: '/scanner/cup-handle',
      sampleSize: cupBest.trades ?? null,
      tone: toneForHitRate(cupBest.winRatePct),
      secondary: [
        { label: 'Strat CAGR', display: fmtPct(cupBest.strategyCagrPct) },
        { label: 'Bench CAGR', display: fmtPct(cupBest.benchCagrPct) },
      ],
    });
  }

  const cagr = parsePct(regime?.backtestCagr);
  const maxDd = parsePct(regime?.backtestMaxDd);
  const rich = richSurvivalStory(cagr, maxDd);
  cards.push({
    id: 'make-me-rich',
    title: 'Will the scanner make me rich?',
    group: 'Reality check',
    kind: 'tongueInCheek',
    valuePct: rich.valuePct,
    display: rich.display,
    subtitle: 'Tongue-in-cheek score — edge × ability to not quit',
    detail: rich.detail,
    caveat:
      regime?.backtestWindow
        ? `Grounded in Core + learned-pain backtest (${regime.backtestWindow}). Not a forecast. Getting rich needs path survival, size you can sleep with, and years — not a hit rate.`
        : 'Not a forecast. Getting rich needs path survival, size you can sleep with, and years — not a hit rate.',
    href: '/scanner/core',
    tone: rich.valuePct != null && rich.valuePct >= 40 ? 'ok' : 'warn',
    secondary: [
      { label: 'Paper CAGR', display: regime?.backtestCagr || '—' },
      { label: 'Max DD', display: regime?.backtestMaxDd || '—' },
      { label: 'Calmar', display: regime?.backtestCalmar || '—' },
    ],
  });

  // Sort: reality check first-ish, then by group interest — keep make-me-rich near top of reality, model risks first
  const groupOrder = [
    'Reality check',
    'Book regime',
    'Day trade',
    'COT paper',
    'Defense',
    'Earnings glass',
    'Top Ten',
    'Earnings calendar',
    'Valuations',
    'Macro odds',
    'Patterns',
  ];
  cards.sort((a, b) => {
    const ga = groupOrder.indexOf(a.group);
    const gb = groupOrder.indexOf(b.group);
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);
    if (a.id === 'make-me-rich') return -1;
    if (b.id === 'make-me-rich') return 1;
    return a.title.localeCompare(b.title);
  });

  const sourceCount = results.filter((r) => r.status === 'fulfilled').length;

  return {
    connected: cards.length > 0,
    generatedAt: new Date().toISOString(),
    sourceCount,
    missingSources,
    note:
      'These are live odds and historical hit rates pulled from your scanner dashboards — educational scoreboard, not a crystal ball. Hit rate = share of green periods; model probs = learned estimates; Fed odds = futures-implied.',
    cards,
    message: cards.length
      ? undefined
      : 'No probability inputs found yet. Upload scanner / daytrade / COT / Fed dashboards from your PC refresh.',
  };
}
