'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  DeskTrainerAdvisor,
  DeskTrainerDay,
  DeskTrainerHolding,
  DeskTrainerNewsItem,
  DeskTrainerPack,
  DeskTrainerSession,
  DeskTrainerSleeve,
  DeskTrainerStyle,
} from '@/lib/scanner-desk-trainer-data';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';

type ScannerUser = { email: string; role: string };
type StyleId = 'stick_winners' | 'climate_playbook' | 'chess_advisor' | 'chase_leader';
type CurvePoint = { day: number; book: number; qqq: number; advisor: number };

type ShadowBook = {
  equity: number;
  peak: number;
  holdings: DeskTrainerHolding[];
  entries: Record<string, number>;
  exposurePct: number;
  followedSleeveId: string;
};

type LiveState = {
  sessionId: string;
  dayIndex: number;
  equity: number;
  qqqEquity: number;
  peak: number;
  holdings: DeskTrainerHolding[];
  entries: Record<string, number>;
  weights: Record<string, number>;
  followedSleeveId: string;
  exposurePct: number;
  tradedToday: boolean;
  daysFollowed: number;
  daysOverridden: number;
  curve: CurvePoint[];
  markHistory: Record<string, number[]>;
  shadow: ShadowBook;
  log: string[];
  finished: boolean;
};

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };
const START_EQUITY = 100_000;
const PRESS_PCT = 5.8;
const IMPROVE_PCT = -5;
const RETREAT_EDGE = -7;
const MAX_POSITIONS = 8;

const DEFAULT_STYLES: DeskTrainerStyle[] = [
  {
    id: 'stick_winners',
    label: 'Discipline: Stick to Winners',
    habit: 'good',
    summary: 'Scanner sleeve: lastYearRet / Winners. Chess rules cut weakness and retreat when trailing.',
  },
  {
    id: 'climate_playbook',
    label: 'Climate Playbook',
    habit: 'good',
    summary: 'Scanner picks sleeve by climate: stress → Winners, risk-on → Gap200.',
  },
  {
    id: 'chess_advisor',
    label: 'Chess Advisor',
    habit: 'good',
    summary: 'Keep sleeve; press / improve-worst / retreat. Switch only on a large lead.',
  },
  {
    id: 'chase_leader',
    label: 'Temptation: Chase Leader',
    habit: 'risk',
    summary: 'Always rotate to the hot sleeve. Use to feel the urge — not as default.',
  },
];

function pct(value?: number | null, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function money(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function tone(value?: number | null) {
  if (value == null || Number.isNaN(value)) return 'text-zinc-400';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-rose-300';
  return 'text-zinc-200';
}

function pickSession(sessions: DeskTrainerSession[]): DeskTrainerSession | null {
  if (!sessions.length) return null;
  return sessions[Math.floor(Math.random() * sessions.length)] ?? null;
}

function leaderSleeve(sleeves: DeskTrainerSleeve[]): DeskTrainerSleeve | null {
  if (!sleeves.length) return null;
  return [...sleeves].sort((a, b) => (b.sessionReturnPct ?? -999) - (a.sessionReturnPct ?? -999))[0] ?? null;
}

function equalWeights(tickers: string[], exposurePct: number): Record<string, number> {
  const weights: Record<string, number> = {};
  if (!tickers.length) return weights;
  const each = exposurePct / tickers.length;
  for (const ticker of tickers) weights[ticker] = Number(each.toFixed(2));
  return weights;
}

function remarkHoldings(
  tickers: string[],
  entries: Record<string, number>,
  marks: Record<string, number>,
  weights: Record<string, number>,
): DeskTrainerHolding[] {
  return tickers
    .map((ticker) => {
      const mark = marks[ticker];
      const entry = entries[ticker] ?? mark;
      if (mark == null || entry == null || entry <= 0) return null;
      return {
        ticker,
        weightPct: Number((weights[ticker] ?? 0).toFixed(2)),
        entryPrice: entry,
        markPrice: mark,
        openReturnPct: Number((((mark / entry) - 1) * 100).toFixed(2)),
      };
    })
    .filter(Boolean) as DeskTrainerHolding[];
}

function dayReturnPct(ticker: string, day: DeskTrainerDay, prev: DeskTrainerDay | null): number | null {
  const a = prev?.marks?.[ticker];
  const b = day.marks?.[ticker];
  if (a == null || b == null || a <= 0) return null;
  return ((b / a) - 1) * 100;
}

function indexDayRet(day: DeskTrainerDay, prev: DeskTrainerDay | null): number | null {
  if (day.indexDayRetPct != null) return day.indexDayRetPct;
  return dayReturnPct('QQQ', day, prev);
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function appendMarks(
  history: Record<string, number[]>,
  marks: Record<string, number> | undefined,
  tickers: string[],
): Record<string, number[]> {
  const next = { ...history };
  for (const ticker of [...tickers, 'QQQ']) {
    const mark = marks?.[ticker];
    if (mark == null) continue;
    next[ticker] = [...(next[ticker] ?? []), mark];
  }
  return next;
}

function buildFearHeadline(
  sessionId: string,
  day: DeskTrainerDay,
  indexRet: number | null,
): DeskTrainerNewsItem {
  if (day.news?.[0]) return day.news[0];
  const seed = hashSeed(`${sessionId}:${day.dayIndex}:${day.label}`);
  const r = indexRet ?? 0;
  const panic = day.pressure?.panicRisk || r <= -2.5;
  const fear = day.pressure?.dip || r <= -1 || panic;
  const relief = r >= 1.2 && !panic;

  const panicPool = [
    `BREAKING: Markets plunge ${pct(r)} as war fears spike — risk assets sold hard`,
    `FLASH: Flight to safety — Nasdaq slammed ${pct(r)} on shock headlines`,
    `ALERT: Liquidity scare — QQQ ${pct(r)}. Desks cutting risk.`,
    `SHOCK: Rate / inflation scare hits tech — index ${pct(r)}`,
  ];
  const fearPool = [
    `Tape heavy: QQQ ${pct(r)} — cut or hold? Scanner still has a ticket.`,
    `Outflows after ${pct(r)} session — fear of catching a falling knife`,
    `Leaders wobble (${pct(r)}). Don't invent a new system mid-drawdown.`,
  ];
  const flatPool = [
    `Quiet tape. Boredom is not a signal — run the scanner ticket.`,
    `No catalyst. Climate: ${day.climate?.label || 'n/a'}. Follow the sheet.`,
  ];
  const reliefPool = [
    `Bounce: QQQ ${pct(r)}. Euphoria is as dangerous as panic — stick to the ticket.`,
  ];

  const pool = panic ? panicPool : relief ? reliefPool : fear ? fearPool : flatPool;
  const headline = pool[seed % pool.length]!;
  return {
    tag: panic ? 'PANIC' : fear ? 'FEAR' : relief ? 'RELIEF' : 'WIRE',
    tone: panic ? 'panic' : fear ? 'fear' : relief ? 'relief' : 'neutral',
    headline,
  };
}

function chessReasons(holdings: DeskTrainerHolding[], edgeVsQqq: number) {
  const cuts: string[] = [];
  const reasons: string[] = [];
  let exposureCapPct = 100;
  for (const h of holdings) {
    if ((h.openReturnPct ?? 0) <= IMPROVE_PCT) {
      cuts.push(h.ticker);
      reasons.push(`SELL ${h.ticker}: open P/L ${pct(h.openReturnPct)} (improve-worst).`);
    }
  }
  if (edgeVsQqq <= RETREAT_EDGE) {
    exposureCapPct = 50;
    reasons.push(`SIZE: trail QQQ by ${pct(edgeVsQqq)} → cap exposure at 50%.`);
  }
  if (holdings.length) {
    const best = [...holdings].sort((a, b) => (b.openReturnPct ?? -999) - (a.openReturnPct ?? -999))[0];
    if ((best?.openReturnPct ?? 0) >= PRESS_PCT) {
      reasons.push(`PRESS ${best.ticker}: open P/L ${pct(best.openReturnPct)} — lean weight, don't chase new names.`);
    }
  }
  return { cuts, reasons, exposureCapPct };
}

function buildStyleAdvisor(
  styleId: StyleId,
  day: DeskTrainerDay,
  live: {
    equity: number;
    qqqEquity: number;
    holdings: DeskTrainerHolding[];
    followedSleeveId: string;
  },
): DeskTrainerAdvisor {
  const sleeves = day.sleeves ?? [];
  const edge = live.qqqEquity > 0 ? (live.equity / live.qqqEquity - 1) * 100 : 0;
  const chess = chessReasons(live.holdings, edge);
  const winners = sleeves.find((s) => s.id === 'winners');
  const climateSleeveId = day.climate?.sleeveId || 'winners';
  const climateSleeve = sleeves.find((s) => s.id === climateSleeveId) ?? winners;
  const leader = leaderSleeve(sleeves);
  const followed = sleeves.find((s) => s.id === live.followedSleeveId);

  let action = 'HOLD';
  let followedSleeveId = live.followedSleeveId;
  let target = live.holdings.map((h) => h.ticker);
  const reasons = [...chess.reasons];

  if (styleId === 'stick_winners') {
    followedSleeveId = 'winners';
    target = [...(winners?.top ?? target)];
    reasons.unshift('Scanner: Winners sleeve (lastYearRet).');
  } else if (styleId === 'climate_playbook') {
    followedSleeveId = climateSleeveId;
    target = [...(climateSleeve?.top ?? target)];
    reasons.unshift(
      `Scanner climate ${day.climate?.label || 'unknown'}: ${day.climate?.reason || 'follow playbook sleeve.'}`,
    );
  } else if (styleId === 'chase_leader') {
    followedSleeveId = leader?.id || live.followedSleeveId;
    target = [...(leader?.top ?? target)];
    action = 'SWITCH';
    reasons.unshift(`Temptation scanner: rotate to ${leader?.label || followedSleeveId}.`);
  } else {
    const leadRet = leader?.sessionReturnPct ?? -999;
    const folRet = followed?.sessionReturnPct ?? 0;
    if (leader && leader.id !== live.followedSleeveId && leadRet - folRet >= 8) {
      action = 'SWITCH';
      followedSleeveId = leader.id;
      target = [...(leader.top ?? target)];
      reasons.unshift(`Switch allowed: ${leader.label} ahead by ${pct(leadRet - folRet)}.`);
    } else {
      reasons.unshift('Chess: keep sleeve unless a large lead or cut rule fires.');
    }
  }

  const kept = target.filter((t) => !chess.cuts.includes(t));
  for (const ticker of target) {
    if (kept.length >= 5) break;
    if (!kept.includes(ticker) && !chess.cuts.includes(ticker)) kept.push(ticker);
  }
  const refill = sleeves.find((s) => s.id === followedSleeveId)?.top ?? [];
  for (const ticker of refill) {
    if (kept.length >= 5) break;
    if (!kept.includes(ticker)) kept.push(ticker);
  }

  if (chess.cuts.length && action === 'HOLD') action = 'REBALANCE';
  if (chess.exposureCapPct < 100 && action === 'HOLD') action = 'REDUCE';
  if (!reasons.length) reasons.push('No trigger. HOLD the book.');

  const sells = chess.cuts;
  const buys = kept.filter((t) => !live.holdings.some((h) => h.ticker === t));
  const holds = kept.filter((t) => live.holdings.some((h) => h.ticker === t));

  const summary =
    action === 'HOLD' && !sells.length && !buys.length
      ? 'HOLD all names. No scanner change today.'
      : [
          sells.length ? `SELL ${sells.join(', ')}` : null,
          buys.length ? `BUY ${buys.join(', ')}` : null,
          holds.length ? `HOLD ${holds.join(', ')}` : null,
          `SIZE ${chess.exposureCapPct}%`,
        ]
          .filter(Boolean)
          .join(' · ');

  return {
    action,
    summary,
    reasons: reasons.slice(0, 6),
    cuts: sells,
    adds: buys,
    targetHoldings: kept.slice(0, 5),
    exposureCapPct: chess.exposureCapPct,
    followedSleeveId,
  };
}

function applyAdvisorToBook(
  book: {
    holdings: DeskTrainerHolding[];
    entries: Record<string, number>;
    followedSleeveId: string;
    exposurePct: number;
  },
  day: DeskTrainerDay,
  advisor: DeskTrainerAdvisor,
) {
  const marks = day.marks ?? {};
  const entries = { ...book.entries };
  const followed = advisor.followedSleeveId || book.followedSleeveId;
  const exposure = advisor.exposureCapPct ?? book.exposurePct;
  const nextTickers = (advisor.targetHoldings?.length ? advisor.targetHoldings : book.holdings.map((h) => h.ticker)).slice(
    0,
    5,
  );

  for (const ticker of nextTickers) {
    if (!(ticker in entries) && marks[ticker] != null) entries[ticker] = marks[ticker];
  }
  for (const key of Object.keys(entries)) {
    if (!nextTickers.includes(key)) delete entries[key];
  }
  const weights = equalWeights(nextTickers, exposure);
  const holdings = remarkHoldings(nextTickers, entries, marks, weights);

  return {
    holdings,
    entries,
    weights,
    followedSleeveId: followed,
    exposurePct: exposure,
    note: advisor.summary || advisor.action || 'Ticket applied',
  };
}

function settleBook(
  holdings: DeskTrainerHolding[],
  entries: Record<string, number>,
  weights: Record<string, number>,
  exposurePct: number,
  equity: number,
  peak: number,
  day: DeskTrainerDay,
) {
  const nextMarks = day.outcome?.nextMarks ?? {};
  const marks = day.marks ?? {};
  let dayRet = 0;
  const invested = Math.min(1, exposurePct / 100);
  if (holdings.length && invested > 0) {
    const weightSum = holdings.reduce((sum, h) => sum + (weights[h.ticker] ?? h.weightPct ?? 0), 0) || 1;
    for (const h of holdings) {
      const wPct = weights[h.ticker] ?? h.weightPct ?? 0;
      const w = (invested * wPct) / weightSum;
      const a = marks[h.ticker];
      const b = nextMarks[h.ticker];
      if (a && b && a > 0) dayRet += w * (b / a - 1);
    }
  }
  const nextEquity = equity * (1 + dayRet);
  return {
    equity: nextEquity,
    peak: Math.max(peak, nextEquity),
    holdings: remarkHoldings(
      holdings.map((h) => h.ticker),
      entries,
      nextMarks,
      weights,
    ),
    weights,
  };
}

function settleQqq(qqqEquity: number, day: DeskTrainerDay): number {
  const qa = day.marks?.QQQ;
  const qb = day.outcome?.nextMarks?.QQQ;
  const qRet = qa && qb && qa > 0 ? qb / qa - 1 : 0;
  return qqqEquity * (1 + qRet);
}

function seedLive(session: DeskTrainerSession, styleId: StyleId): LiveState | null {
  const day0 = session.days?.[0];
  if (!day0) return null;
  let followed = 'winners';
  if (styleId === 'climate_playbook') followed = day0.climate?.sleeveId || 'winners';
  if (styleId === 'chase_leader') followed = leaderSleeve(day0.sleeves ?? [])?.id || 'winners';
  const sleeve = day0.sleeves?.find((s) => s.id === followed) ?? day0.sleeves?.[0];
  const tickers = sleeve?.top?.length ? sleeve.top : (day0.portfolio?.holdings ?? []).map((h) => h.ticker);
  const entries: Record<string, number> = {};
  const kept: string[] = [];
  for (const ticker of tickers) {
    const mark = day0.marks?.[ticker];
    if (mark == null) continue;
    entries[ticker] = mark;
    kept.push(ticker);
  }
  const weights = equalWeights(kept, 100);
  const holdings = remarkHoldings(kept, entries, day0.marks ?? {}, weights);
  const shadow: ShadowBook = {
    equity: START_EQUITY,
    peak: START_EQUITY,
    holdings: [...holdings],
    entries: { ...entries },
    exposurePct: 100,
    followedSleeveId: followed,
  };
  return {
    sessionId: session.id,
    dayIndex: 0,
    equity: START_EQUITY,
    qqqEquity: START_EQUITY,
    peak: START_EQUITY,
    holdings,
    entries,
    weights,
    followedSleeveId: followed,
    exposurePct: 100,
    tradedToday: false,
    daysFollowed: 0,
    daysOverridden: 0,
    curve: [{ day: 0, book: START_EQUITY, qqq: START_EQUITY, advisor: START_EQUITY }],
    markHistory: appendMarks({}, day0.marks, kept),
    shadow,
    log: [`Started ${session.id} · ${session.eraMask || 'hidden era'} · style ${styleId}`],
    finished: false,
  };
}

function linePath(values: number[], w: number, h: number, pad: number) {
  if (!values.length) return '';
  const min = Math.min(...values) * 0.995;
  const max = Math.max(...values) * 1.005;
  const span = Math.max(max - min, 1);
  return values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = pad + (1 - (v - min) / span) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function Sparkline({ values, down }: { values: number[]; down?: boolean }) {
  if (values.length < 2) {
    return <div className="h-8 w-20 rounded bg-zinc-900" />;
  }
  return (
    <svg viewBox="0 0 80 32" className="h-8 w-20" aria-hidden>
      <path d={linePath(values, 80, 32, 2)} fill="none" stroke={down ? '#f43f5e' : '#38bdf8'} strokeWidth="2" />
    </svg>
  );
}

function QqqChart({ curve, indexRet, history }: { curve: CurvePoint[]; indexRet: number | null; history: number[] }) {
  const values = history.length >= 2 ? history : curve.map((p) => p.qqq);
  const last = curve[curve.length - 1]?.qqq ?? START_EQUITY;
  const sessionPct = ((last / START_EQUITY) - 1) * 100;
  const w = 640;
  const h = 160;
  const pad = 10;
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Index · QQQ</p>
          <p className={`font-mono text-3xl font-black ${tone(indexRet)}`}>{pct(indexRet)} today</p>
        </div>
        <p className={`font-mono text-sm font-bold ${tone(sessionPct)}`}>session {pct(sessionPct)}</p>
      </div>
      {values.length < 2 ? (
        <p className="py-10 text-center text-sm text-zinc-500">Day 1 — advance to draw the path.</p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-36 w-full" role="img" aria-label="QQQ chart">
          <path
            d={linePath(values, w, h, pad)}
            fill="none"
            stroke={(indexRet ?? 0) < 0 ? '#f43f5e' : '#a1a1aa'}
            strokeWidth="2.5"
          />
        </svg>
      )}
    </div>
  );
}

function BookChart({ curve }: { curve: CurvePoint[] }) {
  if (curve.length < 2) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-500">
        You vs rules chart builds as days advance.
      </div>
    );
  }
  const w = 640;
  const h = 160;
  const pad = 10;
  const all = curve.flatMap((p) => [p.book, p.advisor, p.qqq]);
  const min = Math.min(...all) * 0.995;
  const max = Math.max(...all) * 1.005;
  const span = Math.max(max - min, 1);
  const pathFor = (key: 'book' | 'advisor' | 'qqq') =>
    curve
      .map((p, i) => {
        const x = pad + (i / Math.max(curve.length - 1, 1)) * (w - pad * 2);
        const y = pad + (1 - (p[key] - min) / span) * (h - pad * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">You · Rules · QQQ</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-36 w-full" role="img" aria-label="Equity comparison">
        <path d={pathFor('qqq')} fill="none" stroke="#71717a" strokeWidth="2" strokeDasharray="5 4" />
        <path d={pathFor('advisor')} fill="none" stroke="#fbbf24" strokeWidth="2" />
        <path d={pathFor('book')} fill="none" stroke="#38bdf8" strokeWidth="2.5" />
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs">
        <span className="text-sky-300">You</span>
        <span className="text-amber-300">Rules</span>
        <span className="text-zinc-400">QQQ</span>
      </div>
    </div>
  );
}

function ScoreVsRules({
  youEquity,
  rulesEquity,
  qqqEquity,
  daysFollowed,
  daysOverridden,
}: {
  youEquity: number;
  rulesEquity: number;
  qqqEquity: number;
  daysFollowed: number;
  daysOverridden: number;
}) {
  const youPct = (youEquity / START_EQUITY - 1) * 100;
  const rulesPct = (rulesEquity / START_EQUITY - 1) * 100;
  const qqqPct = (qqqEquity / START_EQUITY - 1) * 100;
  const edge = youPct - rulesPct;
  return (
    <section className="grid gap-3 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4 sm:grid-cols-5">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-sky-400">You</p>
        <p className={`mt-1 font-mono text-2xl font-black ${tone(youPct)}`}>{money(youEquity)}</p>
        <p className={`text-xs font-mono ${tone(youPct)}`}>{pct(youPct)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-amber-400">Rules book</p>
        <p className={`mt-1 font-mono text-2xl font-black ${tone(rulesPct)}`}>{money(rulesEquity)}</p>
        <p className={`text-xs font-mono ${tone(rulesPct)}`}>{pct(rulesPct)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">QQQ</p>
        <p className={`mt-1 font-mono text-2xl font-black ${tone(qqqPct)}`}>{money(qqqEquity)}</p>
        <p className={`text-xs font-mono ${tone(qqqPct)}`}>{pct(qqqPct)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">You vs rules</p>
        <p className={`mt-1 font-mono text-2xl font-black ${tone(edge)}`}>{pct(edge)}</p>
        <p className="text-xs text-zinc-500">{edge >= 0 ? 'Ahead of rules' : 'Behind rules'}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">Matched scanner</p>
        <p className="mt-1 font-mono text-2xl font-black text-zinc-100">
          {daysFollowed}
          <span className="text-zinc-500">/</span>
          {daysFollowed + daysOverridden || 0}
        </p>
        <p className="text-xs text-zinc-500">days your book = ticket</p>
      </div>
    </section>
  );
}

function TradeDesk({
  advisor,
  styleLabel,
  holdings,
  sellBox,
  buyBox,
  sellPick,
  buyPick,
  sellOptions,
  buyOptions,
  exposurePct,
  onSellPick,
  onBuyPick,
  onAddSell,
  onAddBuy,
  onRemoveSell,
  onRemoveBuy,
  onQueueSell,
  onFillFromScanner,
  onClearBoxes,
  onExecute,
  onExposure,
  onAdvance,
  finished,
  tradedToday,
}: {
  advisor: DeskTrainerAdvisor;
  styleLabel: string;
  holdings: DeskTrainerHolding[];
  sellBox: string[];
  buyBox: string[];
  sellPick: string;
  buyPick: string;
  sellOptions: string[];
  buyOptions: string[];
  exposurePct: number;
  onSellPick: (v: string) => void;
  onBuyPick: (v: string) => void;
  onAddSell: () => void;
  onAddBuy: () => void;
  onRemoveSell: (t: string) => void;
  onRemoveBuy: (t: string) => void;
  onQueueSell: (t: string) => void;
  onFillFromScanner: () => void;
  onClearBoxes: () => void;
  onExecute: () => void;
  onExposure: (pct: number) => void;
  onAdvance: () => void;
  finished: boolean;
  tradedToday: boolean;
}) {
  const suggestSells = advisor.cuts ?? [];
  const suggestBuys = advisor.adds ?? [];
  const size = advisor.exposureCapPct ?? 100;

  return (
    <section className="space-y-4">
      <article className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Scanner suggestion (does nothing by itself)</p>
            <p className="mt-1 text-sm font-bold text-zinc-200">
              {advisor.action || 'HOLD'} · {styleLabel} · size {size}%
            </p>
            <p className="mt-1 text-xs text-zinc-400">{advisor.summary}</p>
          </div>
          <button
            type="button"
            onClick={onFillFromScanner}
            className="rounded-full border border-amber-600/70 px-3 py-1.5 text-xs font-bold text-amber-200 hover:border-amber-400"
          >
            Copy suggestion into my boxes
          </button>
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Suggests sell {suggestSells.length ? suggestSells.join(', ') : 'none'} · buy{' '}
          {suggestBuys.length ? suggestBuys.join(', ') : 'none'}. You still have to execute.
        </p>
      </article>

      <section className="rounded-2xl border-2 border-sky-600/40 bg-sky-950/20 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-400">Your orders — you fill these</p>
        <h3 className="mt-1 text-xl font-black text-zinc-100">Nothing trades until you hit Execute</h3>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-rose-800/70 bg-rose-950/35 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">Sell box</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sellBox.length ? (
                sellBox.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onRemoveSell(t)}
                    className="rounded-lg border border-rose-700 bg-rose-950/60 px-2.5 py-1 font-mono text-sm font-bold text-rose-100 hover:border-rose-400"
                    title="Remove from sell box"
                  >
                    − {t} ×
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Empty — add names to sell</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <select
                value={sellPick}
                onChange={(e) => onSellPick(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="">Pick holding…</option>
                {sellOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddSell}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-bold text-zinc-950 hover:bg-rose-400"
              >
                Add
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {holdings.map((h) => (
                <button
                  key={h.ticker}
                  type="button"
                  onClick={() => onQueueSell(h.ticker)}
                  className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 hover:border-rose-500 hover:text-rose-200"
                >
                  {h.ticker}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-800/70 bg-emerald-950/35 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">Buy box</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {buyBox.length ? (
                buyBox.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onRemoveBuy(t)}
                    className="rounded-lg border border-emerald-700 bg-emerald-950/60 px-2.5 py-1 font-mono text-sm font-bold text-emerald-100 hover:border-emerald-400"
                    title="Remove from buy box"
                  >
                    + {t} ×
                  </button>
                ))
              ) : (
                <p className="text-sm text-zinc-500">Empty — add names to buy</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <select
                value={buyPick}
                onChange={(e) => onBuyPick(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100"
              >
                <option value="">Pick ticker…</option>
                {buyOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddBuy}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-zinc-950 hover:bg-emerald-400"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {[100, 75, 50, 25, 0].map((exp) => (
            <button
              key={exp}
              type="button"
              onClick={() => onExposure(exp)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                exposurePct === exp ? 'bg-sky-500 text-zinc-950' : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
              }`}
            >
              {exp === 0 ? 'Cash' : `${exp}% in`}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExecute}
            className="rounded-full bg-sky-400 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-sky-300"
          >
            {tradedToday ? 'Execute again' : 'Execute my buys & sells'}
          </button>
          <button
            type="button"
            onClick={onClearBoxes}
            className="rounded-full border border-zinc-600 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:border-zinc-400"
          >
            Clear boxes
          </button>
          <button
            type="button"
            disabled={finished}
            onClick={onAdvance}
            className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
          >
            {finished ? 'Session complete' : 'Advance to next day (no auto-trade)'}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Advance only marks your current book to the next day. It never buys or sells for you. The rules book (score only)
          still runs the scanner ticket in the background.
        </p>
      </section>
    </section>
  );
}

export default function DeskTrainerClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [pack, setPack] = useState<DeskTrainerPack | null>(null);
  const [session, setSession] = useState<DeskTrainerSession | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [styleId, setStyleId] = useState<StyleId>('stick_winners');
  const [sellBox, setSellBox] = useState<string[]>([]);
  const [buyBox, setBuyBox] = useState<string[]>([]);
  const [sellPick, setSellPick] = useState('');
  const [buyPick, setBuyPick] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastReveal, setLastReveal] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scanner/desk-trainer', fetchInit)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || payload?.message || 'Failed to load Risk Trainer');
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setUser(payload.user ?? null);
        setPack(payload.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Risk Trainer');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const styles = pack?.styles?.length ? pack.styles : DEFAULT_STYLES;
  const activeStyle = styles.find((s) => s.id === styleId) ?? styles[0];

  const day = useMemo(() => {
    if (!session || !live) return null;
    return session.days?.[live.dayIndex] ?? null;
  }, [session, live]);

  const prevDay = useMemo(() => {
    if (!session || !live || live.dayIndex <= 0) return null;
    return session.days?.[live.dayIndex - 1] ?? null;
  }, [session, live]);

  const advisor = useMemo(() => {
    if (!day || !live) return null;
    return buildStyleAdvisor(styleId, day, live);
  }, [day, live, styleId]);

  const indexRet = day ? indexDayRet(day, prevDay) : null;
  const headline = live && day ? buildFearHeadline(live.sessionId, day, indexRet) : null;

  const tradeUniverse = useMemo(() => {
    if (!day) return [] as string[];
    const set = new Set<string>();
    for (const s of day.sleeves ?? []) {
      for (const t of s.top ?? []) set.add(t);
    }
    for (const t of Object.keys(day.marks ?? {})) {
      if (t !== 'QQQ') set.add(t);
    }
    return [...set].sort();
  }, [day]);

  const clearBoxes = () => {
    setSellBox([]);
    setBuyBox([]);
    setSellPick('');
    setBuyPick('');
  };

  const startSession = () => {
    const next = pickSession(pack?.sessions ?? []);
    if (!next) {
      setError('No trainer sessions available yet.');
      return;
    }
    const seeded = seedLive(next, styleId);
    if (!seeded) {
      setError('Could not seed session.');
      return;
    }
    setSession(next);
    setLive(seeded);
    clearBoxes();
    setLastReveal('');
    setError('');
  };

  const addSell = (ticker?: string) => {
    const t = (ticker || sellPick).toUpperCase();
    if (!t || !live?.holdings.some((h) => h.ticker === t)) return;
    if (sellBox.includes(t)) return;
    setSellBox([...sellBox, t]);
    setSellPick('');
  };

  const addBuy = (ticker?: string) => {
    const t = (ticker || buyPick).toUpperCase();
    if (!t || !day?.marks?.[t]) return;
    if (live?.holdings.some((h) => h.ticker === t) || buyBox.includes(t) || sellBox.includes(t)) return;
    setBuyBox([...buyBox, t]);
    setBuyPick('');
  };

  const fillFromScanner = () => {
    if (!advisor || !live) return;
    setSellBox([...(advisor.cuts ?? [])].filter((t) => live.holdings.some((h) => h.ticker === t)));
    setBuyBox([...(advisor.adds ?? [])].filter((t) => day?.marks?.[t] != null));
    if (advisor.exposureCapPct != null) {
      setLive({ ...live, exposurePct: advisor.exposureCapPct });
    }
  };

  const executeTrades = () => {
    if (!live || !day) return;
    if (!sellBox.length && !buyBox.length) {
      setError('Put names in the buy or sell box first, then Execute.');
      return;
    }
    let tickers = live.holdings.map((h) => h.ticker).filter((t) => !sellBox.includes(t));
    const entries = { ...live.entries };
    for (const t of sellBox) delete entries[t];
    for (const t of buyBox) {
      if (tickers.length >= MAX_POSITIONS) break;
      if (tickers.includes(t)) continue;
      const mark = day.marks?.[t];
      if (mark == null) continue;
      tickers.push(t);
      entries[t] = mark;
    }
    const exposure = tickers.length ? Math.max(live.exposurePct, 25) : 0;
    const weights = equalWeights(tickers, exposure);
    const holdings = remarkHoldings(tickers, entries, day.marks ?? {}, weights);
    setLive({
      ...live,
      holdings,
      entries,
      weights,
      exposurePct: exposure,
      tradedToday: true,
      markHistory: appendMarks(live.markHistory, day.marks, tickers),
      log: [
        `${day.label}: EXECUTE sell[${sellBox.join(',') || '—'}] buy[${buyBox.join(',') || '—'}]`,
        ...live.log,
      ].slice(0, 50),
    });
    clearBoxes();
    setError('');
  };

  const setExposure = (exposurePct: number) => {
    if (!live || !day) return;
    const tickers = live.holdings.map((h) => h.ticker);
    const weights = equalWeights(tickers, exposurePct);
    setLive({
      ...live,
      exposurePct,
      weights,
      holdings: remarkHoldings(tickers, live.entries, day.marks ?? {}, weights),
      log: [`${day.label}: SIZE → ${exposurePct}%`, ...live.log].slice(0, 50),
    });
  };

  const bookMatchesTicket = (holdings: DeskTrainerHolding[], exposurePct: number, tip: DeskTrainerAdvisor) => {
    const yours = new Set(holdings.map((h) => h.ticker));
    const target = new Set(tip.targetHoldings ?? []);
    if (yours.size !== target.size) return false;
    for (const t of yours) if (!target.has(t)) return false;
    return Math.abs(exposurePct - (tip.exposureCapPct ?? 100)) < 1;
  };

  const advanceDay = () => {
    if (!live || !day || !session || !advisor) return;

    // Your book never auto-trades — only settles current holdings.
    const matched = bookMatchesTicket(live.holdings, live.exposurePct, advisor);
    const daysFollowed = live.daysFollowed + (matched ? 1 : 0);
    const daysOverridden = live.daysOverridden + (matched ? 0 : 1);

    const shadowApplied = applyAdvisorToBook(
      live.shadow,
      day,
      buildStyleAdvisor(styleId, day, {
        equity: live.shadow.equity,
        qqqEquity: live.qqqEquity,
        holdings: live.shadow.holdings,
        followedSleeveId: live.shadow.followedSleeveId,
      }),
    );
    const shadowSettled = settleBook(
      shadowApplied.holdings,
      shadowApplied.entries,
      shadowApplied.weights,
      shadowApplied.exposurePct,
      live.shadow.equity,
      live.shadow.peak,
      day,
    );
    const youSettled = settleBook(live.holdings, live.entries, live.weights, live.exposurePct, live.equity, live.peak, day);
    const nextQqq = settleQqq(live.qqqEquity, day);
    const nextIndex = live.dayIndex + 1;
    const finished = nextIndex >= (session.days?.length ?? 0);

    setLastReveal(
      `${day.label} → you ${pct((youSettled.equity / live.equity - 1) * 100)} · rules ${pct(
        (shadowSettled.equity / live.shadow.equity - 1) * 100,
      )} · QQQ ${pct((nextQqq / live.qqqEquity - 1) * 100)} · ${matched ? 'matched scanner' : 'did not match'}`,
    );

    const curvePoint: CurvePoint = {
      day: nextIndex,
      book: youSettled.equity,
      qqq: nextQqq,
      advisor: shadowSettled.equity,
    };

    clearBoxes();

    if (finished) {
      setLive({
        ...live,
        equity: youSettled.equity,
        peak: youSettled.peak,
        holdings: youSettled.holdings,
        weights: youSettled.weights,
        qqqEquity: nextQqq,
        finished: true,
        tradedToday: false,
        daysFollowed,
        daysOverridden,
        curve: [...live.curve, curvePoint],
        shadow: {
          equity: shadowSettled.equity,
          peak: shadowSettled.peak,
          holdings: shadowSettled.holdings,
          entries: shadowApplied.entries,
          exposurePct: shadowApplied.exposurePct,
          followedSleeveId: shadowApplied.followedSleeveId,
        },
        log: [
          `DONE · you ${pct((youSettled.equity / START_EQUITY - 1) * 100)} · rules ${pct(
            (shadowSettled.equity / START_EQUITY - 1) * 100,
          )} · matched ${daysFollowed}/${daysFollowed + daysOverridden}`,
          ...live.log,
        ].slice(0, 50),
      });
      return;
    }

    const nextDay = session.days?.[nextIndex];
    const holdings = remarkHoldings(
      youSettled.holdings.map((h) => h.ticker),
      live.entries,
      nextDay?.marks ?? {},
      youSettled.weights,
    );
    const shadowHoldings = remarkHoldings(
      shadowSettled.holdings.map((h) => h.ticker),
      shadowApplied.entries,
      nextDay?.marks ?? {},
      shadowApplied.weights,
    );

    setLive({
      ...live,
      equity: youSettled.equity,
      peak: youSettled.peak,
      holdings,
      weights: youSettled.weights,
      qqqEquity: nextQqq,
      dayIndex: nextIndex,
      tradedToday: false,
      daysFollowed,
      daysOverridden,
      curve: [...live.curve, curvePoint],
      markHistory: appendMarks(live.markHistory, nextDay?.marks, holdings.map((h) => h.ticker)),
      shadow: {
        equity: shadowSettled.equity,
        peak: shadowSettled.peak,
        holdings: shadowHoldings,
        entries: shadowApplied.entries,
        exposurePct: shadowApplied.exposurePct,
        followedSleeveId: shadowApplied.followedSleeveId,
      },
      log: live.log,
    });
  };

  const heldSet = new Set(live?.holdings.map((h) => h.ticker) ?? []);
  const sellOptions = (live?.holdings ?? []).map((h) => h.ticker).filter((t) => !sellBox.includes(t));
  const buyOptions = tradeUniverse.filter((t) => !heldSet.has(t) && !buyBox.includes(t) && !sellBox.includes(t));

  return (
    <>
      <ScannerExtrasNav active="/scanner/desk-trainer" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-300">Loading sessions…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first.</p>
          <a href="/scanner" className="mt-4 inline-flex text-sky-300 hover:text-sky-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          {error ? <p className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</p> : null}
          {pack?.message && !pack.connected ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{pack.message}</p>
          ) : null}

          <section className="rounded-3xl border border-sky-800/40 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-400">Risk Trainer · You trade</p>
            <h2 className="mt-2 text-3xl font-black text-zinc-100">You fill the buy and sell boxes. Advance never auto-trades.</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-300">
              Scanner suggestion is advice only. Put names in your boxes, hit Execute, then Advance. Rules book still runs
              the ticket in the background so you can compare.
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="block min-w-[260px]">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Scanner style</span>
                <select
                  value={styleId}
                  onChange={(e) => setStyleId(e.target.value as StyleId)}
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                >
                  {styles.map((style) => (
                    <option key={style.id} value={style.id}>
                      {style.habit === 'risk' ? '⚠ ' : '✓ '}
                      {style.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={startSession}
                className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-sky-400"
              >
                {live ? 'New random session' : 'Start random session'}
              </button>
              <p className="self-center text-xs text-zinc-500">
                {pack?.sessionCount ?? 0} sessions · {pack?.source || 'n/a'}
              </p>
            </div>
          </section>

          {!live || !day || !session || !advisor || !headline ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h3 className="text-lg font-bold text-zinc-100">How a day works</h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-300">
                <li>Read the fear headline and charts.</li>
                <li>Optionally copy the scanner suggestion into your boxes — or pick your own.</li>
                <li>Hit Execute my buys & sells (required for any trade).</li>
                <li>Advance — only settles prices; never buys/sells for you.</li>
              </ol>
            </section>
          ) : (
            <>
              <ScoreVsRules
                youEquity={live.equity}
                rulesEquity={live.shadow.equity}
                qqqEquity={live.qqqEquity}
                daysFollowed={live.daysFollowed}
                daysOverridden={live.daysOverridden}
              />

              <section
                className={`rounded-2xl border p-5 ${
                  headline.tone === 'panic'
                    ? 'border-rose-600 bg-rose-950/50'
                    : headline.tone === 'fear'
                      ? 'border-amber-600 bg-amber-950/40'
                      : 'border-zinc-700 bg-zinc-900/80'
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">
                  {headline.tag} · {session.id} · {session.eraMask} · {day.label}/{session.days?.length ?? 0}
                </p>
                <p
                  className={`mt-2 text-xl font-black leading-snug sm:text-2xl ${
                    headline.tone === 'panic' || headline.tone === 'fear' ? 'text-rose-50' : 'text-zinc-100'
                  }`}
                >
                  {headline.headline}
                </p>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <QqqChart curve={live.curve} indexRet={indexRet} history={live.markHistory.QQQ ?? []} />
                <BookChart curve={live.curve} />
              </section>

              <TradeDesk
                advisor={advisor}
                styleLabel={activeStyle?.label || styleId}
                holdings={live.holdings}
                sellBox={sellBox}
                buyBox={buyBox}
                sellPick={sellPick}
                buyPick={buyPick}
                sellOptions={sellOptions}
                buyOptions={buyOptions}
                exposurePct={live.exposurePct}
                onSellPick={setSellPick}
                onBuyPick={setBuyPick}
                onAddSell={() => addSell()}
                onAddBuy={() => addBuy()}
                onRemoveSell={(t) => setSellBox(sellBox.filter((x) => x !== t))}
                onRemoveBuy={(t) => setBuyBox(buyBox.filter((x) => x !== t))}
                onQueueSell={(t) => addSell(t)}
                onFillFromScanner={fillFromScanner}
                onClearBoxes={clearBoxes}
                onExecute={executeTrades}
                onExposure={setExposure}
                onAdvance={advanceDay}
                finished={live.finished}
                tradedToday={live.tradedToday}
              />

              {lastReveal ? (
                <p className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-300">{lastReveal}</p>
              ) : null}

              <section className="rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Your book</p>
                    <h3 className="mt-1 text-xl font-bold text-zinc-100">Current positions</h3>
                  </div>
                  <p className="text-xs text-zinc-500">{live.exposurePct}% invested</p>
                </div>
                <div className="flex flex-wrap items-stretch gap-2">
                  {live.holdings.length ? (
                    live.holdings.map((h) => {
                      const dPct = dayReturnPct(h.ticker, day, prevDay);
                      const show = dPct ?? h.openReturnPct ?? null;
                      const hist = live.markHistory[h.ticker] ?? [];
                      return (
                        <div
                          key={h.ticker}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${
                            (show ?? 0) < 0 ? 'border-rose-800/70 bg-rose-950/30' : 'border-zinc-700 bg-zinc-950/70'
                          }`}
                        >
                          <TickerLink ticker={h.ticker} className="min-w-[3.25rem] font-bold text-zinc-100 hover:text-sky-300" />
                          <Sparkline values={hist} down={(show ?? 0) < 0} />
                          <span className={`min-w-[3.5rem] font-mono text-sm font-bold ${tone(show)}`}>{pct(show)}</span>
                          <button
                            type="button"
                            aria-label={`Queue sell ${h.ticker}`}
                            onClick={() => addSell(h.ticker)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-700 bg-rose-950/50 text-lg font-black text-rose-200 hover:border-rose-400"
                            title="Add to sell box"
                          >
                            −
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-zinc-500">Cash — put names in the buy box and Execute.</p>
                  )}
                </div>
              </section>

              {live.finished ? (
                <section className="rounded-2xl border border-emerald-700/50 bg-emerald-950/20 p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Session report</p>
                  <h3 className="mt-2 text-2xl font-black text-zinc-100">You vs rules</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <p className="text-sm text-zinc-300">
                      You{' '}
                      <span className={`font-mono font-bold ${tone((live.equity / START_EQUITY - 1) * 100)}`}>
                        {pct((live.equity / START_EQUITY - 1) * 100)}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-300">
                      Rules{' '}
                      <span className={`font-mono font-bold ${tone((live.shadow.equity / START_EQUITY - 1) * 100)}`}>
                        {pct((live.shadow.equity / START_EQUITY - 1) * 100)}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-300">
                      Matched scanner{' '}
                      <span className="font-mono font-bold text-zinc-100">
                        {live.daysFollowed}/{live.daysFollowed + live.daysOverridden}
                      </span>{' '}
                      days
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={startSession}
                    className="mt-5 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:bg-sky-400"
                  >
                    Run another session
                  </button>
                </section>
              ) : null}

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                <h3 className="text-lg font-bold text-zinc-100">Decision log</h3>
                <div className="mt-3 space-y-2 text-sm text-zinc-400">
                  {live.log.map((line, i) => (
                    <p key={`${i}-${line.slice(0, 20)}`} className="border-b border-zinc-800/80 pb-2">
                      {line}
                    </p>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
