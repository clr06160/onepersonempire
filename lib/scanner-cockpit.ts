import { loadScannerAgents } from '@/lib/scanner-agents';
import {
  COCKPIT_MISSION,
  COCKPIT_PLAYBOOK,
  COCKPIT_RAILS,
  COCKPIT_SUMMARY,
} from '@/lib/scanner-cockpit-constitution';
import { loadScannerData } from '@/lib/scanner-data';
import type { EarningsReactionBadge, EarningsReactionTicker } from '@/lib/scanner-earnings-reaction';
import { loadEarningsReactionBadges } from '@/lib/scanner-earnings-reaction';
import { loadPickContextPayload, type PickContext } from '@/lib/scanner-pick-context';
import { loadPeGlassDashboard } from '@/lib/scanner-pe-glass-data';

export type CockpitGauge = {
  id: string;
  label: string;
  value: number;
  display: string;
  tone: 'ok' | 'warn' | 'hot' | 'cold' | 'neutral';
  detail?: string;
};

export type CockpitCandidate = {
  ticker: string;
  score: number;
  weightPct: number;
  reasons: string[];
  sources: string[];
  vetoed: boolean;
  animal?: string;
  runwayScore?: number | null;
  glassBucket?: string;
  earningsBadge?: EarningsReactionBadge | null;
  threeDayReactionPct?: number | null;
};

export type CockpitBook = {
  asOf?: string;
  grossExposurePct: number;
  cashPct: number;
  powerTrendOn: boolean;
  regimeLabel: string;
  monthlyBreakerArmed: boolean;
  names: CockpitCandidate[];
  gravy?: { ticker: string; weightPct: number; note: string } | null;
  missionBrief: string[];
};

export type CockpitPayload = {
  connected: boolean;
  generatedAt: string;
  source?: string;
  message?: string;
  mission: typeof COCKPIT_MISSION;
  rails: typeof COCKPIT_RAILS;
  playbook: typeof COCKPIT_PLAYBOOK;
  summary: string;
  gauges: CockpitGauge[];
  instruments: {
    powerTrend: string;
    powerTrendOn: boolean;
    regimeLabel: string;
    regimeBadge?: string;
    bestAgent?: { label: string; rank: number; returnPct: number; systemId: string };
    topAgents: Array<{ label: string; rank: number; returnPct: number; systemId: string }>;
    scannerAsOf?: string;
  };
  book: CockpitBook;
  watchList: CockpitCandidate[];
  constitutionLine: string;
};

type ScannerSystem = {
  id?: string;
  label?: string;
  top?: string[];
  powertrend?: string;
  powertrendOn?: boolean;
  regimeLabel?: string;
  regimeBadge?: string;
  asOf?: string;
  date?: string;
  isHoldVariant?: boolean;
  usesLedgerHoldings?: boolean;
  holdReturnPct?: number;
};

function toneForReturn(pct: number | null | undefined): CockpitGauge['tone'] {
  if (pct == null || Number.isNaN(pct)) return 'neutral';
  if (pct >= 5) return 'hot';
  if (pct > 0) return 'ok';
  if (pct > -5) return 'warn';
  return 'cold';
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function tallyOverlaps(systems: ScannerSystem[]): Map<string, { count: number; sources: string[] }> {
  const map = new Map<string, { count: number; sources: string[] }>();
  for (const system of systems) {
    const id = String(system.id || '');
    if (!id || id === 'daily-raw-bear' || id === 'cup-handle') continue;
    // Prefer live/research parents + holds; skip duplicate noise
    for (const raw of system.top || []) {
      const ticker = String(raw).toUpperCase();
      if (!ticker) continue;
      const prior = map.get(ticker) || { count: 0, sources: [] };
      prior.count += 1;
      if (system.label && prior.sources.length < 6) prior.sources.push(system.label);
      map.set(ticker, prior);
    }
  }
  return map;
}

function scoreCandidate(args: {
  ticker: string;
  overlaps: number;
  inBestAgent: boolean;
  inBestScanTop: boolean;
  context?: PickContext;
  roomToFill: boolean;
  earningsWin: boolean;
  earningsBadge?: EarningsReactionBadge | null;
}): { score: number; reasons: string[]; vetoed: boolean } {
  const reasons: string[] = [];
  let score = 0;
  const ctx = args.context;

  if (ctx?.vetoed) {
    return { score: -100, reasons: ctx.vetoReasons.length ? ctx.vetoReasons : ['Vetoed'], vetoed: true };
  }

  if (args.inBestAgent) {
    score += 28;
    reasons.push('On best forward agent book');
  }
  if (args.inBestScanTop) {
    score += 18;
    reasons.push('Top of leading scan');
  }
  if (args.overlaps >= 3) {
    score += 22;
    reasons.push(`In ${args.overlaps} scans`);
  } else if (args.overlaps === 2) {
    score += 12;
    reasons.push('In 2 scans');
  }

  if (args.roomToFill) {
    score += 16;
    reasons.push('Earnings glass · room to fill');
  }
  if (args.earningsWin) {
    score += 10;
    reasons.push('Prior earnings reaction positive');
  }
  if (args.earningsBadge === 'pass') {
    score += 12;
    reasons.push('Earn PASS+ (day+3 ≥ +10%)');
  } else if (args.earningsBadge === 'fail') {
    score -= 8;
    reasons.push('Earn FAIL− (day+3 ≤ −10%)');
  }

  if (ctx?.inTopTenBook) {
    score += 8;
    reasons.push('Top Ten book');
  }
  if (ctx?.runwayScore != null && ctx.runwayScore >= 60) {
    score += 8;
    reasons.push(`Runway ${Math.round(ctx.runwayScore)}`);
  }
  if (ctx?.musicStopsRisk != null && ctx.musicStopsRisk >= 70) {
    score -= 12;
    reasons.push('Music-stops risk elevated');
  }
  if (ctx?.animal === 'Eagle' || ctx?.animal === 'Bull') {
    score += 6;
    reasons.push(ctx.animal);
  }
  if (ctx?.theme?.direction === 'Rotating In' || ctx?.theme?.direction === 'Up') {
    score += 6;
    reasons.push(`Theme ${ctx.theme.direction}`);
  }
  if (ctx?.flowSignal && /accumulat|inflow|buy/i.test(ctx.flowSignal)) {
    score += 5;
    reasons.push(`Flow ${ctx.flowSignal}`);
  }

  return { score, reasons, vetoed: false };
}

function buildWeights(names: CockpitCandidate[], grossPct: number): CockpitCandidate[] {
  if (!names.length) return [];
  const positive = names.filter((n) => n.score > 0);
  const pool = positive.length ? positive : names;
  const totalScore = pool.reduce((sum, n) => sum + Math.max(n.score, 1), 0);
  return pool.map((n) => ({
    ...n,
    weightPct: Math.round((Math.max(n.score, 1) / totalScore) * grossPct * 10) / 10,
  }));
}

export async function buildCockpitPayload(): Promise<CockpitPayload> {
  const generatedAt = new Date().toISOString();
  const [scanner, agents, pickContext, peGlass, reactionBadges] = await Promise.all([
    loadScannerData().catch(
      (): Awaited<ReturnType<typeof loadScannerData>> => ({
        connected: false,
        systems: [],
      }),
    ),
    loadScannerAgents().catch(
      (): Awaited<ReturnType<typeof loadScannerAgents>> => ({
        connected: false,
        leaderboard: [],
        agents: {},
      }),
    ),
    loadPickContextPayload().catch(
      (): Awaited<ReturnType<typeof loadPickContextPayload>> => ({
        connected: false,
        byTicker: {},
        lenses: [],
      }),
    ),
    loadPeGlassDashboard().catch(() => null),
    loadEarningsReactionBadges().catch(() => ({ byTicker: {} })),
  ]);

  const systems = (scanner.systems || []) as ScannerSystem[];
  const first = systems[0];
  const powerTrendOn = Boolean(
    systems.find((s) => s.powertrendOn != null)?.powertrendOn ?? first?.powertrendOn,
  );
  const powerTrend =
    systems.find((s) => s.powertrend)?.powertrend ||
    (powerTrendOn ? 'POWER TREND ON' : 'POWER TREND OFF');
  const regimeLabel = String(
    systems.find((s) => s.regimeLabel)?.regimeLabel || first?.regimeLabel || 'FULL',
  ).toUpperCase();
  const regimeBadge = systems.find((s) => s.regimeBadge)?.regimeBadge || first?.regimeBadge;
  const scannerAsOf = String(first?.asOf || first?.date || agents.asOf || '');

  const leaderboard = [...(agents.leaderboard || [])].sort(
    (a, b) => (a.rank ?? 999) - (b.rank ?? 999),
  );
  const topAgents = leaderboard.slice(0, 5).map((row) => ({
    label: row.label,
    rank: row.rank ?? 0,
    returnPct: row.totalReturnPct,
    systemId: row.systemId,
  }));
  const bestAgent = topAgents[0];

  const bestSystem =
    (bestAgent && systems.find((s) => s.id === bestAgent.systemId)) ||
    systems.find((s) => s.id === 'raw10') ||
    systems.find((s) => (s.top || []).length > 0);

  const bestTop = new Set((bestSystem?.top || []).map((t) => String(t).toUpperCase()));

  let agentHoldings = new Set<string>();
  if (bestAgent) {
    const agentId =
      Object.keys(agents.agents || {}).find(
        (id) => agents.agents?.[id]?.systemId === bestAgent.systemId,
      ) || `agent-${bestAgent.systemId}`;
    const holdings = agents.agents?.[agentId]?.holdings || [];
    agentHoldings = new Set(holdings.map((t) => String(t).toUpperCase()));
  }

  const overlaps = tallyOverlaps(systems);

  const roomTickers = new Set<string>();
  for (const t of peGlass?.bucketTop10?.room || []) roomTickers.add(String(t).toUpperCase());
  for (const row of peGlass?.rows || []) {
    if (row.verdict === 'room' && row.ticker) roomTickers.add(String(row.ticker).toUpperCase());
  }
  for (const bucket of peGlass?.forwardTest?.buckets || []) {
    const key = String(bucket.key || bucket.label || '').toLowerCase();
    if (key.includes('room') || key.includes('fill')) {
      for (const t of bucket.currentTickers || []) roomTickers.add(String(t).toUpperCase());
    }
  }

  const byTicker = pickContext.byTicker || {};
  const reactionByTicker: Record<string, EarningsReactionTicker> = reactionBadges.byTicker ?? {};
  const candidateTickers = new Set<string>([
    ...bestTop,
    ...agentHoldings,
    ...[...overlaps.entries()].filter(([, v]) => v.count >= 2).map(([t]) => t),
    ...roomTickers,
  ]);

  const scored: CockpitCandidate[] = [];
  for (const ticker of candidateTickers) {
    const ctx = byTicker[ticker];
    const reaction = reactionByTicker[ticker];
    const earningsBadge =
      reaction?.badge ?? ctx?.earnings?.reactionBadge ?? null;
    const threeDayReactionPct =
      reaction?.threeDayReactionPct ?? ctx?.earnings?.threeDayReactionPct ?? null;
    const overlap = overlaps.get(ticker);
    const { score, reasons, vetoed } = scoreCandidate({
      ticker,
      overlaps: overlap?.count || 0,
      inBestAgent: agentHoldings.has(ticker),
      inBestScanTop: bestTop.has(ticker),
      context: ctx,
      roomToFill: roomTickers.has(ticker),
      earningsWin:
        earningsBadge === 'pass' ||
        (threeDayReactionPct ?? 0) > 0 ||
        (ctx?.earnings?.immediateReactionPct ?? 0) > 0,
      earningsBadge,
    });
    scored.push({
      ticker,
      score,
      weightPct: 0,
      reasons,
      sources: overlap?.sources || [],
      vetoed,
      animal: ctx?.animal,
      runwayScore: ctx?.runwayScore,
      glassBucket: roomTickers.has(ticker) ? 'room' : undefined,
      earningsBadge,
      threeDayReactionPct,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const eligible = scored.filter((c) => !c.vetoed && c.score > 0);

  // Default: 100% invested. Only CASH regime or monthly breaker force cash.
  let gross = 100;
  if (regimeLabel.includes('CASH') || regimeLabel === '0') gross = 0;
  else if (regimeLabel.includes('HALF') || regimeLabel.includes('0.5')) gross = 100; // stay fully invested; HALF is reference only on live board
  else gross = 100;

  const take = clamp(
    eligible.length,
    Math.min(COCKPIT_RAILS.minCoreNames, eligible.length || 0),
    COCKPIT_RAILS.maxCoreNames,
  );
  const core = eligible.slice(0, take || Math.min(10, eligible.length));
  const weighted = buildWeights(core, gross);

  // Soft monthly breaker flag — paper cockpit doesn't have live month P&L yet; use avg of top agents as proxy
  const avgAgentRet =
    topAgents.length > 0
      ? topAgents.reduce((s, a) => s + a.returnPct, 0) / topAgents.length
      : 0;
  const monthlyBreakerArmed = avgAgentRet <= COCKPIT_RAILS.monthlyCircuitBreakerPct;
  // Live board still shows a synthesis book; forward paper enforces true cash on breaker.
  const targetGross = monthlyBreakerArmed ? 0 : gross;

  let gravy: CockpitBook['gravy'] = null;
  if (powerTrendOn && targetGross >= 100 && !monthlyBreakerArmed) {
    gravy = {
      ticker: 'SOXL',
      weightPct: 0,
      note: 'Optional gravy — off by default on forward paper (knob to enable)',
    };
  }

  const missionBrief = [
    bestAgent
      ? `Leading forward engine: #${bestAgent.rank} ${bestAgent.label} (${bestAgent.returnPct > 0 ? '+' : ''}${bestAgent.returnPct.toFixed(2)}%).`
      : 'No agent leaderboard yet — using live scanner tops.',
    powerTrendOn
      ? 'PowerTrend ON — size up; 3× gravy allowed.'
      : 'PowerTrend OFF — trade a bit lighter (still mostly invested).',
    `Regime ${regimeLabel} → target gross ~${targetGross}%.`,
    monthlyBreakerArmed
      ? 'Circuit breaker armed (proxy): stand down most new risk this stretch.'
      : 'Circuit breaker clear — stay invested bias on.',
    COCKPIT_SUMMARY,
  ];

  const scoreTotal = weighted.reduce((s, n) => s + Math.max(n.score, 1), 0) || 1;
  for (const name of weighted) {
    name.weightPct = Math.round((Math.max(name.score, 1) / scoreTotal) * targetGross * 10) / 10;
  }
  const sumW = weighted.reduce((s, n) => s + n.weightPct, 0);
  if (weighted.length && Math.abs(sumW - targetGross) >= 0.1) {
    weighted[0].weightPct = Math.round((weighted[0].weightPct + (targetGross - sumW)) * 10) / 10;
  }

  const gauges: CockpitGauge[] = [
    {
      id: 'mission',
      label: 'Year chase',
      value: clamp((bestAgent?.returnPct ?? 0) + 20, 0, 100),
      display: bestAgent ? `${bestAgent.returnPct > 0 ? '+' : ''}${bestAgent.returnPct.toFixed(1)}%` : '—',
      tone: toneForReturn(bestAgent?.returnPct),
      detail: 'Best agent forward return',
    },
    {
      id: 'survival',
      label: 'Survive rail',
      value: monthlyBreakerArmed ? 12 : 82,
      display: monthlyBreakerArmed ? 'BRAKE' : 'CLEAR',
      tone: monthlyBreakerArmed ? 'cold' : 'ok',
      detail: 'Month −5% circuit breaker',
    },
    {
      id: 'thrust',
      label: 'Gross thrust',
      value: targetGross,
      display: `${targetGross}%`,
      tone: targetGross >= 85 ? 'hot' : targetGross >= 50 ? 'ok' : 'warn',
      detail: 'Target invested %',
    },
    {
      id: 'pt',
      label: 'PowerTrend',
      value: powerTrendOn ? 92 : 28,
      display: powerTrendOn ? 'ON' : 'OFF',
      tone: powerTrendOn ? 'hot' : 'warn',
      detail: powerTrend,
    },
    {
      id: 'regime',
      label: 'Regime',
      value: regimeLabel.includes('CASH') ? 8 : regimeLabel.includes('HALF') ? 50 : 88,
      display: regimeLabel,
      tone: regimeLabel.includes('CASH') ? 'cold' : regimeLabel.includes('HALF') ? 'warn' : 'ok',
      detail: regimeBadge || 'Learned / overlay stack',
    },
    {
      id: 'overlap',
      label: 'Overlap fuel',
      value: clamp(eligible.filter((c) => (overlaps.get(c.ticker)?.count || 0) >= 2).length * 8, 0, 100),
      display: `${eligible.filter((c) => (overlaps.get(c.ticker)?.count || 0) >= 2).length}`,
      tone: 'ok',
      detail: 'Multi-scan names in pool',
    },
  ];

  return {
    connected: Boolean(scanner.connected !== false || systems.length),
    generatedAt,
    source: scanner.source,
    mission: COCKPIT_MISSION,
    rails: COCKPIT_RAILS,
    playbook: COCKPIT_PLAYBOOK,
    summary: COCKPIT_SUMMARY,
    gauges,
    instruments: {
      powerTrend,
      powerTrendOn,
      regimeLabel,
      regimeBadge,
      bestAgent,
      topAgents,
      scannerAsOf,
    },
    book: {
      asOf: scannerAsOf || agents.asOf,
      grossExposurePct: targetGross,
      cashPct: Math.max(0, 100 - targetGross),
      powerTrendOn,
      regimeLabel,
      monthlyBreakerArmed,
      names: weighted,
      gravy: monthlyBreakerArmed ? null : gravy,
      missionBrief,
    },
    watchList: eligible.slice(take, take + 8),
    constitutionLine: COCKPIT_SUMMARY,
  };
}
