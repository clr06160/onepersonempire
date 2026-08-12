'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  ChessSelectionLesson,
  ChessSelectionPayload,
  ChessSelectionVariant,
} from '@/lib/scanner-chess-selection-data';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const traderPrinciples = [
  {
    title: 'Separate the jobs',
    body: 'Selection chooses the pieces, chess manages the position, and regime decides how hard to press. Bad traders mix those jobs together and change the whole system after one painful day.',
    evidence: 'Chess picking was negative OOS, but chess management added about 4.7-4.9% vs QQQ. The job that worked was management.',
  },
  {
    title: 'Buy durable strength',
    body: 'The best pure stock-picking signal so far is not the prettiest story or the biggest 3-week burst. It is trailing one-year strength: names that have already proven persistent demand.',
    evidence: 'lastYearRet beat QQQ by about 6.0% per half-year at n=5 and passed all 3 folds. Short accel and roomToRun alone lost.',
  },
  {
    title: 'Manage winners, do not worship them',
    body: 'A good trader lets winners earn more weight, but only by rule. Press the best name after it proves itself; do not press because you are excited or because everyone is talking about it.',
    evidence: 'The chess rule presses a winner after roughly +5.8%, then caps the press around 30% instead of turning the book into one bet.',
  },
  {
    title: 'Fix the worst piece early',
    body: 'The book does not need heroic loyalty to losers. When one name is clearly damaging the position, improve the piece: replace it, reduce it, or stop letting it consume attention.',
    evidence: 'The live chess layer removes weak pieces around -5% and rotates completed 126-session lots.',
  },
  {
    title: 'Do not panic into cash',
    body: 'Regime awareness is not a panic button. The evidence favors soft caps and confirmation. Going all-cash can feel safe, but it often destroys the good-year capture that pays for the system.',
    evidence: 'always_full beat binary cash on the winning lastYearRet draft; confirm_vol and jump_kappa were close, but panic/binary gates hurt capture.',
  },
  {
    title: 'Judge years correctly',
    body: 'The goal is not to beat QQQ every single year. The goal is to stay close to flat in hostile years and capture enough upside in good years to compound.',
    evidence: 'The regime scorecard explicitly rewards bad-year survival plus good-year capture, not twitchy benchmark chasing.',
  },
];

const goodTraderHabits = [
  'Uses the scanner as a decision aid, then follows the pre-written rules.',
  'Keeps position size boring enough to survive being wrong.',
  'Reviews on cadence: daily risk check, weekly Raw10 review, monthly selection review.',
  'Writes down why a trade exists before changing it.',
  'Lets evidence kill attractive ideas quickly: roomBand-on-winners, short accel, and panic cash were killed.',
  'Compares every idea to QQQ and to the current control book.',
];

const badTraderHabits = [
  'Changes the selection formula after every drawdown.',
  'Adds to losers because the thesis sounds smart.',
  'Cuts winners because the gain feels too good to keep.',
  'Goes all-in when the scanner is hot, then all-cash when volatility spikes.',
  'Treats one article, one backtest, or one lucky month as proof.',
  'Confuses activity with discipline.',
];

const emotionalRules = [
  {
    label: 'Fear',
    good: 'Reduce by rule when the book or regime says so.',
    bad: 'Sell everything after the damage is already obvious.',
  },
  {
    label: 'Greed',
    good: 'Press a proven winner inside a cap.',
    bad: 'Oversize the hottest name because it feels inevitable.',
  },
  {
    label: 'Boredom',
    good: 'Let 126-session holds work unless a rule fires.',
    bad: 'Force trades because nothing changed today.',
  },
  {
    label: 'Ego',
    good: 'Admit when the test killed your favorite idea.',
    bad: 'Keep adding filters until a dead idea looks alive.',
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

function LessonCard({
  title,
  accent,
  lesson,
}: {
  title: string;
  accent: string;
  lesson?: ChessSelectionLesson;
}) {
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className={`text-lg font-bold ${accent}`}>{title}</h3>
        <span className="rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
          {lesson?.status || 'Research'}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{lesson?.summary || 'No lesson summary yet.'}</p>
      <ul className="mt-3 space-y-1.5 text-xs leading-5 text-zinc-400">
        {(lesson?.rules ?? []).map((rule) => (
          <li key={rule} className="flex gap-2">
            <span className={accent}>◆</span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      {lesson?.evidence ? (
        <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">{lesson.evidence}</p>
      ) : null}
    </article>
  );
}

function ChangePills({ label, tickers, kind }: { label: string; tickers?: string[]; kind: 'add' | 'remove' }) {
  const colors =
    kind === 'add'
      ? 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200'
      : 'border-rose-700/60 bg-rose-950/50 text-rose-200';
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="flex min-h-8 flex-wrap gap-2">
        {tickers?.length ? (
          tickers.map((ticker) => (
            <TickerLink
              key={ticker}
              ticker={ticker}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${colors}`}
            />
          ))
        ) : (
          <span className="text-sm text-zinc-600">None today</span>
        )}
      </div>
    </div>
  );
}

function VariantCard({
  variant,
  selected,
  onSelect,
}: {
  variant: ChessSelectionVariant;
  selected: boolean;
  onSelect: () => void;
}) {
  const metrics = variant.metrics ?? {};
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-2xl border p-5 text-left transition ${
        selected
          ? 'border-amber-400/80 bg-amber-950/25 shadow-[0_0_35px_rgba(245,158,11,0.09)]'
          : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{variant.shortLabel}</p>
          <h3 className="mt-1 text-xl font-bold text-zinc-100">{variant.label}</h3>
        </div>
        <span
          className={`rounded-full px-3 py-1 font-mono text-xs font-bold ${
            (variant.exposurePct ?? 0) >= 100
              ? 'bg-emerald-950 text-emerald-300'
              : (variant.exposurePct ?? 0) >= 70
                ? 'bg-amber-950 text-amber-300'
                : 'bg-rose-950 text-rose-300'
          }`}
        >
          {variant.exposurePct ?? 0}% book
        </span>
      </div>
      <p className="mt-3 min-h-10 text-sm text-zinc-400">{variant.description}</p>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Forward</p>
          <p className={`mt-1 font-mono text-lg font-bold ${tone(metrics.totalReturnPct)}`}>
            {pct(metrics.totalReturnPct)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">vs QQQ</p>
          <p className={`mt-1 font-mono text-lg font-bold ${tone(metrics.edgeQqqPct)}`}>{pct(metrics.edgeQqqPct)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-600">Updates</p>
          <p className="mt-1 font-mono text-lg font-bold text-zinc-200">{metrics.updates ?? 0}</p>
        </div>
      </div>
    </button>
  );
}

function RegimePanel({ data }: { data: ChessSelectionPayload }) {
  const regime = data.regime;
  if (!regime) return null;
  const warningLabels = [
    regime.warnings?.oilSpike ? 'Oil spike' : null,
    regime.warnings?.rateSensitiveCrack ? 'Rate-sensitive crack' : null,
    regime.warnings?.defensivesLead ? 'Defensives leading' : null,
  ].filter(Boolean);
  const postureTone =
    regime.posture === 'FULL'
      ? 'border-emerald-700/50 bg-emerald-950/30 text-emerald-200'
      : regime.posture === 'PRE-FLIP WATCH'
        ? 'border-amber-600/60 bg-amber-950/30 text-amber-200'
        : 'border-rose-700/50 bg-rose-950/30 text-rose-200';

  return (
    <section className={`rounded-2xl border p-5 ${postureTone}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-70">Regime game today</p>
          <h2 className="mt-1 text-2xl font-bold">
            {regime.posture} · {regime.exposurePct}% cap
          </h2>
          <p className="mt-1 text-sm opacity-80">Climate: {regime.climate || 'unknown'}</p>
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <div>
            <p className="text-[10px] uppercase opacity-60">Oil 63d</p>
            <p className="font-mono font-bold">{pct(regime.rotation?.oil63Pct)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase opacity-60">Cyc − def</p>
            <p className="font-mono font-bold">{pct(regime.rotation?.cyclicalDefensiveSpreadPct)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase opacity-60">Tech RS</p>
            <p className="font-mono font-bold">{pct(regime.rotation?.techRsPct)}</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {warningLabels.length ? (
          warningLabels.map((label) => (
            <span key={label} className="rounded-full border border-current/30 px-3 py-1">
              {label}
            </span>
          ))
        ) : (
          <span className="opacity-70">No early-warning trigger.</span>
        )}
        {regime.rotation?.crackingFirst?.length ? (
          <span className="rounded-full border border-current/30 px-3 py-1">
            Cracking first: {regime.rotation.crackingFirst.join(', ')}
          </span>
        ) : null}
      </div>
        {regime.existingScanner?.badge ? (
          <p className="mt-4 border-t border-current/15 pt-3 text-xs opacity-75">
            Existing scanner context: {regime.existingScanner.badge}
            {regime.existingScanner.reason ? ` · ${regime.existingScanner.reason}` : ''}
          </p>
        ) : null}
        {regime.switch?.metric ? (
          <p className="mt-3 text-xs opacity-80">
            Climate Switch draft today: <span className="font-bold">{regime.switch.metric}</span>
            {regime.switch.bucket ? ` · ${regime.switch.bucket}` : ''}
            {regime.switch.reason ? ` · ${regime.switch.reason}` : ''}
          </p>
        ) : null}
      </section>
    );
  }

function TraderTutorial() {
  return (
    <section className="overflow-hidden rounded-3xl border border-amber-800/35 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_34%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))]">
      <div className="border-b border-amber-900/30 px-5 py-5 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-400">Trading tutorial</p>
        <h2 className="mt-2 text-2xl font-black text-zinc-100">How to be a good trader with this scanner</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-300">
          The evidence says the edge is not genius prediction. It is buying durable strength, keeping the book small
          enough to manage, pressing only when earned, cutting damage early, and refusing to panic when the market gets
          noisy.
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1.35fr_0.9fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {traderPrinciples.map((item) => (
            <article key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-950/65 p-4">
              <h3 className="text-base font-bold text-amber-200">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{item.body}</p>
              <p className="mt-3 border-t border-zinc-800 pt-3 text-xs leading-5 text-zinc-500">{item.evidence}</p>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-900/45 bg-emerald-950/20 p-4">
            <h3 className="text-lg font-bold text-emerald-200">What a good trader does</h3>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-emerald-50/85">
              {goodTraderHabits.map((habit) => (
                <li key={habit} className="flex gap-2">
                  <span className="text-emerald-300">+</span>
                  <span>{habit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-rose-900/45 bg-rose-950/20 p-4">
            <h3 className="text-lg font-bold text-rose-200">What a bad trader does</h3>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-rose-50/85">
              {badTraderHabits.map((habit) => (
                <li key={habit} className="flex gap-2">
                  <span className="text-rose-300">-</span>
                  <span>{habit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
            <h3 className="text-lg font-bold text-zinc-100">Personality that fits the evidence</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Patient, skeptical, rule-following, and emotionally slow. The best personality here is not fearless. It is
              calm enough to let winners work, humble enough to cut losers, and disciplined enough to avoid inventing new
              rules mid-storm.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 bg-zinc-950/55 p-5 sm:p-6">
        <h3 className="text-lg font-bold text-zinc-100">Emotional discipline checklist</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {emotionalRules.map((rule) => (
            <article key={rule.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h4 className="font-bold text-amber-200">{rule.label}</h4>
              <p className="mt-2 text-xs uppercase tracking-wider text-emerald-300">Good response</p>
              <p className="mt-1 text-sm leading-5 text-zinc-300">{rule.good}</p>
              <p className="mt-3 text-xs uppercase tracking-wider text-rose-300">Bad response</p>
              <p className="mt-1 text-sm leading-5 text-zinc-400">{rule.bad}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ChessSelectionClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ChessSelectionPayload | null>(null);
  const [selectedId, setSelectedId] = useState('raw10_chess');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scanner/chess-selection', fetchInit)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || payload?.message || 'Failed to load Chess Selection');
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        setUser(payload.user ?? null);
        setData(payload.data ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load Chess Selection');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => {
    const variants = data?.variants ?? [];
    return variants.find((variant) => variant.id === selectedId) ?? variants[0];
  }, [data, selectedId]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/chess-selection" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-300">
          Setting the forward-test board…
        </section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first.</p>
          <a href="/scanner" className="mt-4 inline-flex text-amber-300 hover:text-amber-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-7">
          {error ? <p className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</p> : null}
          {data?.message && !data?.connected ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">What survived research</p>
                <h2 className="mt-1 text-2xl font-bold text-zinc-100">The games, and what each one earned</h2>
              </div>
              <p className="hidden max-w-md text-right text-xs text-zinc-500 md:block">
                Management has the strongest OOS evidence. Selection, winners, and regime remain hypotheses under live
                test.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <LessonCard title="Chess game" accent="text-amber-300" lesson={data?.learned?.chess} />
              <LessonCard title="Selection game" accent="text-cyan-300" lesson={data?.learned?.selection} />
              <LessonCard title="Raw PowerTrend" accent="text-emerald-300" lesson={data?.learned?.raw10} />
              <LessonCard title="Winners metric" accent="text-orange-300" lesson={data?.learned?.winners} />
              <LessonCard title="Climate switch" accent="text-sky-300" lesson={data?.learned?.climateSwitch} />
              <LessonCard title="Regime game" accent="text-violet-300" lesson={data?.learned?.regime} />
            </div>
          </section>

          {data ? <RegimePanel data={data} /> : null}

          <TraderTutorial />

          <section>
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Forward tests</p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-100">Let the variants compete from today forward</h2>
              <p className="mt-2 text-sm text-zinc-400">
                The first build seeds each $100,000 paper book. Returns begin after the next completed market session.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {(data?.variants ?? []).map((variant) => (
                <VariantCard
                  key={variant.id}
                  variant={variant}
                  selected={selected?.id === variant.id}
                  onSelect={() => setSelectedId(variant.id)}
                />
              ))}
            </div>
          </section>

          {selected ? (
            <>
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
                <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto]">
                  <ChangePills label="Added today" tickers={selected.additions} kind="add" />
                  <ChangePills label="Subtracted today" tickers={selected.removals} kind="remove" />
                  <div className="min-w-44 md:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Paper equity</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-zinc-100">{money(selected.metrics?.equity)}</p>
                    <p className={`text-xs ${tone(selected.metrics?.maxDrawdownPct)}`}>
                      max DD {pct(selected.metrics?.maxDrawdownPct)}
                    </p>
                  </div>
                </div>
                {selected.management?.length ? (
                  <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                    Today: {selected.management.join(' · ')}
                  </p>
                ) : null}
              </section>

              <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/75">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-800 px-5 py-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Open book</p>
                    <h2 className="mt-1 text-xl font-bold text-zinc-100">{selected.label}</h2>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Target hold {data?.strategy?.targetHoldingSessions ?? 126} sessions · {data?.strategy?.reviewCadence}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1020px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                        <th className="px-5 py-3">Ticker</th>
                        <th className="px-3 py-3">State</th>
                        <th className="px-3 py-3 text-right">Weight</th>
                        <th className="px-3 py-3 text-right">Open P/L</th>
                        <th className="px-3 py-3 text-right">Held</th>
                        <th className="px-3 py-3">Opened</th>
                        <th className="px-3 py-3 text-right">Entry</th>
                        <th className="px-3 py-3 text-right">Now</th>
                        <th className="px-3 py-3 text-right">Room</th>
                        <th className="px-3 py-3 text-right">NI growth</th>
                        <th className="px-5 py-3 text-right">63d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.holdings ?? []).map((holding) => (
                        <tr key={holding.ticker} className="border-b border-zinc-800/70">
                          <td className="px-5 py-3">
                            <TickerLink ticker={holding.ticker} className="font-bold text-zinc-100 hover:text-amber-300" />
                            <span className="ml-2 text-xs text-zinc-600">#{holding.rank ?? '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                                holding.status === 'ADD'
                                  ? 'bg-emerald-950 text-emerald-300'
                                  : holding.status === 'PRESSED'
                                    ? 'bg-amber-950 text-amber-300'
                                    : 'bg-zinc-800 text-zinc-400'
                              }`}
                            >
                              {holding.status || 'HOLD'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-zinc-200">{pct(holding.weightPct)}</td>
                          <td className={`px-3 py-3 text-right font-mono font-bold ${tone(holding.openReturnPct)}`}>
                            {pct(holding.openReturnPct)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-zinc-300">
                            {holding.holdingDays ?? 0}/{holding.targetHoldingDays ?? 126}
                          </td>
                          <td className="px-3 py-3 text-xs text-zinc-400">{holding.openedAt || '—'}</td>
                          <td className="px-3 py-3 text-right font-mono text-zinc-400">
                            {holding.entryPrice?.toFixed(2) ?? '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-zinc-200">
                            {holding.currentPrice?.toFixed(2) ?? '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-cyan-300">
                            {pct(holding.roomToRunPct)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-zinc-300">
                            {pct(holding.netIncomeGrowthPct)}
                          </td>
                          <td className={`px-5 py-3 text-right font-mono ${tone(holding.ret63Pct)}`}>
                            {pct(holding.ret63Pct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                  <h2 className="text-lg font-bold text-zinc-100">Recent book changes</h2>
                  <div className="mt-4 space-y-3">
                    {(selected.recentChanges ?? []).length ? (
                      selected.recentChanges?.map((change, index) => (
                        <div key={`${change.date}-${change.type}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="font-bold text-amber-300">{change.type}</span>
                            <span className="text-zinc-500">{change.date}</span>
                          </div>
                          <p className="mt-2 text-xs text-zinc-400">
                            {change.added?.length ? `Add ${change.added.join(', ')}` : 'No adds'}
                            {' · '}
                            {change.removed?.length ? `Remove ${change.removed.join(', ')}` : 'No removals'}
                            {' · '}
                            {change.exposurePct ?? 0}% book
                          </p>
                          {change.reason ? <p className="mt-1 text-xs text-zinc-600">{change.reason}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-zinc-500">The first refresh will seed this ledger.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
                  <h2 className="text-lg font-bold text-zinc-100">Rules under test</h2>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <dt className="text-xs text-zinc-500">Selection model</dt>
                      <dd className="mt-1 font-mono text-cyan-300">{data?.strategy?.selectionModelId || '—'}</dd>
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <dt className="text-xs text-zinc-500">Review</dt>
                      <dd className="mt-1 text-zinc-200">{data?.strategy?.reviewCadence || '—'}</dd>
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <dt className="text-xs text-zinc-500">Press</dt>
                      <dd className="mt-1 text-zinc-200">Winner &gt; +5.8% → 30% weight</dd>
                    </div>
                    <div className="rounded-xl bg-zinc-950/70 p-3">
                      <dt className="text-xs text-zinc-500">Retreat</dt>
                      <dd className="mt-1 text-zinc-200">Trail QQQ by 7% → half book</dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-xs leading-5 text-zinc-500">{data?.strategy?.disclaimer}</p>
                </div>
              </section>
            </>
          ) : null}

          <section className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
            <div className="rounded-2xl border border-emerald-900/40 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">Raw PowerTrend board</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-100">Live Top10 sleeve</h2>
                </div>
                <p className="text-xs text-zinc-500">Draft pool for Raw10 Control / Raw10 + Chess.</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="py-3 pr-3">#</th>
                      <th className="py-3 pr-3">Ticker</th>
                      <th className="py-3 pr-3 text-right">21d</th>
                      <th className="py-3 text-right">63d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.raw10Board ?? []).map((row) => (
                      <tr key={row.ticker} className="border-b border-zinc-800/70">
                        <td className="py-3 pr-3 font-mono text-zinc-500">{row.rank}</td>
                        <td className="py-3 pr-3">
                          <TickerLink ticker={row.ticker} className="font-bold text-zinc-100 hover:text-emerald-300" />
                        </td>
                        <td className={`py-3 pr-3 text-right font-mono ${tone(row.ret21Pct)}`}>{pct(row.ret21Pct)}</td>
                        <td className={`py-3 text-right font-mono ${tone(row.ret63Pct)}`}>{pct(row.ret63Pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Selection board</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-100">Top 15 research candidates</h2>
                </div>
                <p className="text-xs text-zinc-500">Room-to-run research score.</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="py-3 pr-3">#</th>
                      <th className="py-3 pr-3">Ticker</th>
                      <th className="py-3 pr-3 text-right">Score</th>
                      <th className="py-3 pr-3 text-right">Room</th>
                      <th className="py-3 text-right">63d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.candidateBoard ?? []).map((row) => (
                      <tr key={row.ticker} className="border-b border-zinc-800/70">
                        <td className="py-3 pr-3 font-mono text-zinc-500">{row.rank}</td>
                        <td className="py-3 pr-3">
                          <TickerLink ticker={row.ticker} className="font-bold text-zinc-100 hover:text-cyan-300" />
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-cyan-300">{row.score?.toFixed(3) ?? '—'}</td>
                        <td className="py-3 pr-3 text-right font-mono text-zinc-300">
                          {pct((row.roomToRun ?? 0) * 100)}
                        </td>
                        <td className={`py-3 text-right font-mono ${tone(row.ret63Pct)}`}>{pct(row.ret63Pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-900/40 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">Winners board</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-100">Top 15 by trailing 1-year return</h2>
                </div>
                <p className="text-xs text-zinc-500">Draft pool for Winners Control / Winners + Chess.</p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="py-3 pr-3">#</th>
                      <th className="py-3 pr-3">Ticker</th>
                      <th className="py-3 pr-3 text-right">1y</th>
                      <th className="py-3 pr-3 text-right">Room</th>
                      <th className="py-3 text-right">63d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.winnersBoard ?? []).map((row) => (
                      <tr key={row.ticker} className="border-b border-zinc-800/70">
                        <td className="py-3 pr-3 font-mono text-zinc-500">{row.rank}</td>
                        <td className="py-3 pr-3">
                          <TickerLink ticker={row.ticker} className="font-bold text-zinc-100 hover:text-orange-300" />
                        </td>
                        <td className={`py-3 pr-3 text-right font-mono font-bold ${tone(row.lastYearRetPct)}`}>
                          {pct(row.lastYearRetPct)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-zinc-300">
                          {pct((row.roomToRun ?? 0) * 100)}
                        </td>
                        <td className={`py-3 text-right font-mono ${tone(row.ret63Pct)}`}>{pct(row.ret63Pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-sky-900/40 bg-zinc-900/70 p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">Climate Switch board</p>
                  <h2 className="mt-1 text-xl font-bold text-zinc-100">
                    Today&apos;s metric: {data?.regime?.switch?.metric || '—'}
                  </h2>
                </div>
                <p className="text-xs text-zinc-500">
                  {data?.regime?.switch?.bucket || 'bucket'} · draft for Climate Switch books
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-wider text-zinc-500">
                      <th className="py-3 pr-3">#</th>
                      <th className="py-3 pr-3">Ticker</th>
                      <th className="py-3 pr-3 text-right">Active</th>
                      <th className="py-3 pr-3 text-right">1y</th>
                      <th className="py-3 text-right">Gap 200</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.climateSwitchBoard ?? []).map((row) => (
                      <tr key={row.ticker} className="border-b border-zinc-800/70">
                        <td className="py-3 pr-3 font-mono text-zinc-500">{row.rank}</td>
                        <td className="py-3 pr-3">
                          <TickerLink ticker={row.ticker} className="font-bold text-zinc-100 hover:text-sky-300" />
                        </td>
                        <td className="py-3 pr-3 text-right font-mono text-sky-300">{pct((row.score ?? 0) * 100)}</td>
                        <td className={`py-3 pr-3 text-right font-mono ${tone(row.lastYearRetPct)}`}>
                          {pct(row.lastYearRetPct)}
                        </td>
                        <td className={`py-3 text-right font-mono ${tone(row.gapFromSma200Pct)}`}>
                          {pct(row.gapFromSma200Pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <p className="text-xs text-zinc-600">
            As of {data?.asOf || 'n/a'} · built {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'n/a'} ·{' '}
            source {data?.source || 'scanner'}
          </p>
        </div>
      )}
    </>
  );
}
