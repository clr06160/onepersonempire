import type {
  ForwardLedgerAnalysis,
  ForwardLedgerCohortStat,
  ForwardLedgerRecommendation,
  ForwardLedgerTrade,
} from '@/lib/scanner-forward-ledger-types';

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

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return round1((sorted[mid - 1] + sorted[mid]) / 2);
  return round1(sorted[mid]);
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

function pctSigned(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function monthLabel(ym?: string | null) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1] || ym} ${y}`;
}

function cohortStat(key: string, label: string, trades: ForwardLedgerTrade[]): ForwardLedgerCohortStat {
  const closed = trades.filter((t) => t.status === 'closed' && t.returnPct != null);
  const returns = closed.map((t) => t.returnPct!) ;
  const wins = closed.filter((t) => (t.returnPct ?? 0) > 0);
  const losses = closed.filter((t) => (t.returnPct ?? 0) < 0);
  const best = [...closed].sort((a, b) => (b.returnPct ?? -999) - (a.returnPct ?? -999))[0];
  const worst = [...closed].sort((a, b) => (a.returnPct ?? 999) - (b.returnPct ?? 999))[0];

  return {
    key,
    label,
    tradeCount: trades.length,
    closedCount: closed.length,
    winCount: wins.length,
    lossCount: losses.length,
    hitRatePct: closed.length ? round1((100 * wins.length) / closed.length) : null,
    avgReturnPct: mean(returns),
    medianReturnPct: median(returns),
    totalReturnPctSum: returns.length ? round1(returns.reduce((a, b) => a + b, 0)) : null,
    bestTicker: best?.ticker ?? null,
    bestReturnPct: best?.returnPct ?? null,
    worstTicker: worst?.ticker ?? null,
    worstReturnPct: worst?.returnPct ?? null,
  };
}

function buildRecommendations(
  closed: ForwardLedgerTrade[],
  bySystem: ForwardLedgerCohortStat[],
  byTag: ForwardLedgerCohortStat[],
  overall: ForwardLedgerCohortStat,
): ForwardLedgerRecommendation[] {
  const recs: ForwardLedgerRecommendation[] = [];
  if (closed.length < 3) {
    recs.push({
      id: 'warm-up',
      severity: 'info',
      systemId: 'all',
      title: 'Ledger is still warming up',
      detail: 'Need more closed forward-test trades before strong filters. Keep syncing after each earnings cluster.',
      evidence: [`Only ${closed.length} closed trades in this scope.`],
      action: 'Sync the ledger after each scanner refresh; revisit analysis weekly.',
    });
    return recs;
  }

  const crypto = byTag.find((t) => t.key === 'crypto-miner');
  if (
    crypto &&
    crypto.closedCount >= 2 &&
    overall.avgReturnPct != null &&
    crypto.avgReturnPct != null &&
    crypto.avgReturnPct < overall.avgReturnPct - 5
  ) {
    const without = closed.filter((t) => !t.tags.includes('crypto-miner'));
    const withoutAvg = mean(without.map((t) => t.returnPct!).filter((v) => v != null));
    recs.push({
      id: 'skip-crypto-miners',
      severity: 'high',
      systemId: 'earnings-calendar',
      title: 'Skip or hard-size crypto miners in earnings reactor',
      detail:
        'Crypto miner / AI-pivot miner names are dragging expectancy. Operating-company reactors look fine without them.',
      evidence: [
        `Crypto-miner cohort: ${crypto.closedCount} closed, avg ${pctSigned(crypto.avgReturnPct)}, hit ${crypto.hitRatePct ?? '—'}%.`,
        `All closed avg ${pctSigned(overall.avgReturnPct)}; without miners avg ${pctSigned(withoutAvg)}.`,
        crypto.worstTicker
          ? `Worst in cohort: ${crypto.worstTicker} ${pctSigned(crypto.worstReturnPct)}.`
          : 'Worst miner names concentrated the left tail.',
      ],
      action: 'Filter earnings-calendar paper (and live) entries: no CIFR/HUT-class miners unless size ≤25%.',
    });
  }

  const cryptoAdj = byTag.find((t) => t.key === 'crypto-adjacent');
  if (cryptoAdj && cryptoAdj.closedCount >= 2 && (cryptoAdj.avgReturnPct ?? 0) < -3) {
    recs.push({
      id: 'watch-crypto-adjacent',
      severity: 'medium',
      systemId: 'all',
      title: 'Crypto-adjacent names underperforming',
      detail: 'Exchange / crypto-proxy names are soft in this window — treat like high-beta narrative risk.',
      evidence: [
        `${cryptoAdj.closedCount} closed, avg ${pctSigned(cryptoAdj.avgReturnPct)}, hit ${cryptoAdj.hitRatePct ?? '—'}%.`,
      ],
      action: 'Require stronger confirmation (guidance + clean beat) before sizing crypto-adjacent reactors.',
    });
  }

  const ai = byTag.find((t) => t.key === 'ai-infra');
  if (ai && ai.closedCount >= 2 && (ai.avgReturnPct ?? 0) >= (overall.avgReturnPct ?? 0)) {
    recs.push({
      id: 'keep-ai-infra',
      severity: 'info',
      systemId: 'all',
      title: 'Do not blanket-ban AI infra',
      detail: 'AI/cloud infra tags are not the same drag as crypto miners in this sample.',
      evidence: [
        `AI-infra cohort avg ${pctSigned(ai.avgReturnPct)} vs overall ${pctSigned(overall.avgReturnPct)} (${ai.closedCount} closed).`,
      ],
      action: 'Keep AI infra eligible; only cut miners / messy narrative pivots.',
    });
  }

  const weakSystems = bySystem
    .filter((s) => s.closedCount >= 3 && (s.avgReturnPct ?? 0) <= -2)
    .sort((a, b) => (a.avgReturnPct ?? 0) - (b.avgReturnPct ?? 0))
    .slice(0, 2);
  for (const sys of weakSystems) {
    recs.push({
      id: `size-down-${sys.key}`,
      severity: 'medium',
      systemId: sys.key as ForwardLedgerRecommendation['systemId'],
      title: `Size down ${sys.label}`,
      detail: 'This forward book is underwater on the sample — reduce risk until hit rate recovers.',
      evidence: [
        `${sys.closedCount} closed · avg ${pctSigned(sys.avgReturnPct)} · hit ${sys.hitRatePct ?? '—'}%.`,
        sys.worstTicker ? `Worst: ${sys.worstTicker} ${pctSigned(sys.worstReturnPct)}.` : 'Left tail is broad.',
      ],
      action: `Pause full-size paper allocation for ${sys.label}; review stops and entry filters.`,
    });
  }

  const strongSystems = bySystem
    .filter((s) => s.closedCount >= 3 && (s.avgReturnPct ?? 0) >= 3 && (s.hitRatePct ?? 0) >= 55)
    .sort((a, b) => (b.avgReturnPct ?? 0) - (a.avgReturnPct ?? 0))
    .slice(0, 2);
  for (const sys of strongSystems) {
    recs.push({
      id: `lean-into-${sys.key}`,
      severity: 'low',
      systemId: sys.key as ForwardLedgerRecommendation['systemId'],
      title: `Lean into ${sys.label}`,
      detail: 'Positive expectancy with decent hit rate — candidate for more attention / size.',
      evidence: [
        `${sys.closedCount} closed · avg ${pctSigned(sys.avgReturnPct)} · hit ${sys.hitRatePct ?? '—'}%.`,
        sys.bestTicker ? `Best: ${sys.bestTicker} ${pctSigned(sys.bestReturnPct)}.` : 'Winners are distributed.',
      ],
      action: `Keep ${sys.label} in the monthly rotation; study winners for shared traits.`,
    });
  }

  const stopped = byTag.find((t) => t.key === 'stopped-out');
  if (stopped && stopped.closedCount >= 3 && overall.closedCount >= 8) {
    const stopShare = round1((100 * stopped.closedCount) / overall.closedCount);
    if (stopShare >= 35) {
      recs.push({
        id: 'stop-rate-high',
        severity: 'medium',
        systemId: 'all',
        title: 'Stop-outs are common',
        detail: 'A large share of closed trades hit the ATR/stop path — entries may be too early or stops too tight for the cohort.',
        evidence: [`${stopped.closedCount}/${overall.closedCount} closed (${stopShare}%) tagged stopped-out.`],
        action: 'Compare stop distance vs avg winner; consider entering closer to the print for high-ATR names.',
      });
    }
  }

  if (!recs.length) {
    recs.push({
      id: 'steady',
      severity: 'info',
      systemId: 'all',
      title: 'No sharp filter screams yet',
      detail: 'Cohorts are mixed. Keep logging every closed forward trade and re-run analysis monthly.',
      evidence: [
        `${overall.closedCount} closed · avg ${pctSigned(overall.avgReturnPct)} · hit ${overall.hitRatePct ?? '—'}%.`,
      ],
      action: 'Maintain sync cadence; promote any tag that stays weak for 2+ months into a hard rule.',
    });
  }

  return recs;
}

export function analyzeForwardLedger(
  trades: ForwardLedgerTrade[],
  options?: { monthKey?: string | null },
): ForwardLedgerAnalysis {
  const monthKey = options?.monthKey || null;
  const scoped = monthKey ? trades.filter((t) => t.monthKey === monthKey) : trades;
  const closed = scoped.filter((t) => t.status === 'closed' && t.returnPct != null);
  const open = scoped.filter((t) => t.status === 'open');
  const overall = cohortStat('all', 'All systems', scoped);

  const bySystemMap = new Map<string, ForwardLedgerTrade[]>();
  for (const trade of scoped) {
    if (!bySystemMap.has(trade.systemId)) bySystemMap.set(trade.systemId, []);
    bySystemMap.get(trade.systemId)!.push(trade);
  }
  const bySystem = [...bySystemMap.entries()]
    .map(([key, rows]) => cohortStat(key, rows[0]?.systemLabel || key, rows))
    .sort((a, b) => (b.avgReturnPct ?? -999) - (a.avgReturnPct ?? -999));

  const tagKeys = [
    'crypto-miner',
    'crypto-adjacent',
    'ai-infra',
    'high-beta-narrative',
    'stopped-out',
    'winner',
    'loser',
  ] as const;
  const byTag = tagKeys
    .map((tag) => cohortStat(tag, tag, scoped.filter((t) => t.tags.includes(tag))))
    .filter((row) => row.tradeCount > 0);

  const bySleeveMap = new Map<string, ForwardLedgerTrade[]>();
  for (const trade of scoped) {
    if (!trade.sleeve) continue;
    const key = `${trade.systemId}:${trade.sleeve}`;
    if (!bySleeveMap.has(key)) bySleeveMap.set(key, []);
    bySleeveMap.get(key)!.push(trade);
  }
  const bySleeve = [...bySleeveMap.entries()]
    .map(([key, rows]) => cohortStat(key, key, rows))
    .filter((row) => row.closedCount >= 2)
    .sort((a, b) => (b.avgReturnPct ?? -999) - (a.avgReturnPct ?? -999))
    .slice(0, 12);

  const sorted = [...closed].sort((a, b) => (b.returnPct ?? -999) - (a.returnPct ?? -999));

  return {
    generatedAt: new Date().toISOString(),
    scope: monthKey ? 'month' : 'all',
    monthKey,
    monthLabel: monthLabel(monthKey),
    tradeCount: scoped.length,
    closedCount: closed.length,
    openCount: open.length,
    hitRatePct: overall.hitRatePct,
    avgReturnPct: overall.avgReturnPct,
    medianReturnPct: overall.medianReturnPct,
    bySystem,
    byTag,
    bySleeve,
    topWinners: sorted.filter((t) => (t.returnPct ?? 0) > 0).slice(0, 10),
    topLosers: [...sorted].reverse().filter((t) => (t.returnPct ?? 0) < 0).slice(0, 10),
    recommendations: buildRecommendations(closed, bySystem, byTag, overall),
    method: [
      'Universe: closed + open paper trades from every scanner forward test (earnings calendar, Top Ten, catalysts, valuations, day trade, chess, COT, raw bear, earnings glass, first pullbacks, bracket, Flight Deck).',
      'Persisted in Firestore (scannerForwardLedgerTrades) so history accumulates beyond each dashboard’s recentClosed window.',
      'Tags: crypto-miner, crypto-adjacent, ai-infra, high-beta-narrative, stopped-out, winner/loser.',
      'Recommendations compare cohort avg return vs overall and flag size-up / size-down / skip rules.',
      'Call anytime via /api/scanner/ledger/analysis or the Ledger page; monthly reports embed the month slice.',
    ],
    note: scoped.length
      ? null
      : monthKey
        ? 'No ledger trades for this month yet. Sync after forward tests close.'
        : 'Ledger empty — sync from forward tests to start the proprietary database.',
  };
}
