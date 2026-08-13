'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  PeGlassBacktest,
  PeGlassBacktestCompare,
  PeGlassForwardTest,
  PeGlassPayload,
  PeGlassRow,
} from '@/lib/scanner-pe-glass-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function classForScore(n?: number | null) {
  if (n == null || Number.isNaN(n)) return 'text-zinc-400';
  if (n >= 5) return 'text-emerald-300';
  if (n <= -5) return 'text-red-300';
  return 'text-zinc-200';
}

function verdictTone(v?: PeGlassRow['verdict']) {
  switch (v) {
    case 'overflow':
      return { ring: 'ring-red-500/40', glow: 'shadow-red-500/20', bead: '#f87171', fill: 'from-cyan-500/80 to-emerald-500/70' };
    case 'stretched':
      return { ring: 'ring-amber-500/40', glow: 'shadow-amber-500/15', bead: '#fbbf24', fill: 'from-cyan-500/70 to-teal-500/60' };
    case 'room':
      return { ring: 'ring-emerald-500/40', glow: 'shadow-emerald-500/20', bead: '#34d399', fill: 'from-emerald-500/80 to-cyan-600/70' };
    case 'catching':
      return { ring: 'ring-sky-500/35', glow: 'shadow-sky-500/15', bead: '#38bdf8', fill: 'from-cyan-600/70 to-blue-500/50' };
    default:
      return { ring: 'ring-zinc-600/50', glow: 'shadow-zinc-900/40', bead: '#a1a1aa', fill: 'from-cyan-600/60 to-emerald-600/50' };
  }
}

const VERDICT_LEGEND = [
  {
    verdict: 'overflow' as const,
    label: 'Overflowing',
    range: 'Gap ≥ +25%',
    desc: 'Price ran way ahead of earnings — P/E expanded a lot. Higher valuation risk if growth slows.',
  },
  {
    verdict: 'stretched' as const,
    label: 'Stretched',
    range: 'Gap +12% to +24%',
    desc: 'Price moved up more than earnings over 12 months — you are paying a richer multiple than a year ago.',
  },
  {
    verdict: 'balanced' as const,
    label: 'Balanced',
    range: 'Gap −8% to +11%',
    desc: 'Price and earnings roughly kept pace — neither clearly ahead nor behind.',
  },
  {
    verdict: 'catching' as const,
    label: 'Catching up',
    range: 'Gap −9% to −17%',
    desc: 'Price is still below the earnings story — the market has not fully repriced the growth yet.',
  },
  {
    verdict: 'room' as const,
    label: 'Room to fill',
    range: 'Gap ≤ −18%',
    desc: 'Earnings grew much faster than the stock over 12 months. Can mean catch-up potential if profits hold — not a buy signal on its own.',
  },
] as const;

function GlassLegend() {
  return (
    <section className="rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-6 shadow-lg">
      <h2 className="text-lg font-semibold text-zinc-100">How to read the glass</h2>
      <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-300">
        Peter Lynch idea in one picture. Each card compares the <strong className="font-medium text-amber-300">last 12 months of stock price</strong>{' '}
        to the <strong className="font-medium text-emerald-300">last 12 months of earnings growth</strong> (EPS when available, otherwise sales).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Green liquid</p>
          <p className="mt-1 text-sm text-zinc-300">
            How high the glass fills = how strong earnings growth was. Bigger EPS (or sales) growth → higher fill.
          </p>
        </div>
        <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Gold bead</p>
          <p className="mt-1 text-sm text-zinc-300">
            Where price landed over the same 12 months. Bigger price return → bead floats higher on the glass.
          </p>
        </div>
        <div className="rounded-xl border border-zinc-700 bg-zinc-950/50 p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Gap (P/E visual)</p>
          <p className="mt-1 text-sm text-zinc-300">
            <span className="font-mono text-zinc-200">12m price return − 12m earnings growth</span>. Positive = bead above
            liquid (multiple stretched). Negative = bead below liquid (price lagging earnings).
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Verdict labels</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {VERDICT_LEGEND.map((item) => {
          const tone = verdictTone(item.verdict);
          return (
            <li
              key={item.verdict}
              className={`rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 ring-1 ${tone.ring}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-semibold text-zinc-100">{item.label}</span>
                <span className="font-mono text-[11px] text-zinc-500">{item.range}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.desc}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-zinc-500">
        <strong className="font-medium text-zinc-400">Not buy or sell signals.</strong> Overflowing names can keep running
        in a strong trend. Room to fill only means price has not kept up with past earnings — the market may be right to
        discount peak/cyclical EPS, one-time jumps, or weak forward outlook. Use this as a valuation risk lens, not a return
        forecast.
      </p>
    </section>
  );
}

function BacktestBucketTable({ backtest }: { backtest: PeGlassBacktest }) {
  const buckets = [...(backtest.buckets || [])].sort((a, b) => (b.cagrPct ?? -999) - (a.cagrPct ?? -999));
  return (
    <table className="w-full min-w-[720px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-zinc-700 text-left text-zinc-400">
          <th className="py-2 pr-3">Bucket</th>
          <th className="py-2 pr-3 text-right">CAGR</th>
          <th className="py-2 pr-3 text-right">Total</th>
          <th className="py-2 pr-3 text-right">Avg month</th>
          <th className="py-2 pr-3 text-right">Hit rate</th>
          <th className="py-2 pr-3 text-right">Max DD</th>
          <th className="py-2 pr-3 text-right">Periods</th>
        </tr>
      </thead>
      <tbody>
        {buckets.map((bucket) => (
          <tr key={bucket.key} className="border-b border-zinc-800/80">
            <td className="py-2 pr-3 font-semibold text-zinc-100">{bucket.label}</td>
            <td className={`py-2 pr-3 text-right font-mono ${classForScore(bucket.cagrPct)}`}>{pct(bucket.cagrPct)}</td>
            <td className={`py-2 pr-3 text-right font-mono ${classForScore(bucket.totalReturnPct)}`}>
              {pct(bucket.totalReturnPct)}
            </td>
            <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(bucket.avgPeriodReturnPct)}</td>
            <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(bucket.hitRatePct)}</td>
            <td className="py-2 pr-3 text-right font-mono text-red-300/90">{pct(bucket.maxDrawdownPct)}</td>
            <td className="py-2 pr-3 text-right font-mono text-zinc-500">{bucket.periodCount ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BacktestComparePanel({ compare }: { compare?: PeGlassBacktestCompare | null }) {
  if (!compare?.universes?.length) return null;
  return (
    <div className="mb-6 overflow-x-auto">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-300">Universe comparison</p>
      <p className="mb-3 text-sm text-zinc-400">{compare.headline}</p>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="py-2 pr-3">Universe</th>
            <th className="py-2 pr-3">Best bucket</th>
            <th className="py-2 pr-3 text-right">Best CAGR</th>
            <th className="py-2 pr-3 text-right">Room</th>
            <th className="py-2 pr-3 text-right">Overflow</th>
            <th className="py-2 pr-3 text-right">Balanced</th>
          </tr>
        </thead>
        <tbody>
          {compare.universes.map((row) => (
            <tr key={row.universe} className="border-b border-zinc-800/80">
              <td className="py-2 pr-3 font-semibold text-zinc-100">{row.label}</td>
              <td className="py-2 pr-3 text-zinc-300">{row.bestBucketLabel ?? '—'}</td>
              <td className={`py-2 pr-3 text-right font-mono ${classForScore(row.bestCagrPct)}`}>
                {pct(row.bestCagrPct)}
              </td>
              <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(row.roomCagrPct)}</td>
              <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(row.overflowCagrPct)}</td>
              <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(row.balancedCagrPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {compare.note ? <p className="mt-2 text-xs text-zinc-500">{compare.note}</p> : null}
    </div>
  );
}

function BacktestPanel({
  backtest,
  compare,
}: {
  backtest?: PeGlassBacktest | null;
  compare?: PeGlassBacktestCompare | null;
}) {
  const universeOptions = useMemo(() => {
    if (compare?.universes?.length) {
      return compare.universes
        .map((row) => ({
          id: row.universe || row.label || '',
          label: row.label || row.universe || '',
          backtest: row.summary || null,
        }))
        .filter((row) => row.id && row.backtest?.buckets?.length);
    }
    return backtest?.buckets?.length ? [{ id: backtest.universe || 'default', label: backtest.universeLabel || backtest.universe || 'Backtest', backtest }] : [];
  }, [backtest, compare]);

  const [universeId, setUniverseId] = useState('');
  const active =
    universeOptions.find((row) => row.id === universeId)?.backtest ||
    universeOptions[0]?.backtest ||
    backtest;

  useEffect(() => {
    if (!universeOptions.length) return;
    setUniverseId((current) =>
      current && universeOptions.some((row) => row.id === current) ? current : universeOptions[0].id,
    );
  }, [universeOptions]);

  if (!active?.buckets?.length) return null;

  return (
    <section className="rounded-2xl border border-violet-900/50 bg-gradient-to-br from-violet-950/30 to-zinc-900 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">Historical backtest</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">Which bucket wins?</h2>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        Monthly rebalance: positive momentum filter, then top 10 accel names inside each verdict bucket, equal-weight.
        {active.headline ? ` ${active.headline}` : ''}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        {active.start} → {active.end} · top {active.topN} per bucket
      </p>

      <BacktestComparePanel compare={compare} />

      {universeOptions.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {universeOptions.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setUniverseId(row.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                (universeId || universeOptions[0].id) === row.id
                  ? 'border-violet-500 bg-violet-950 text-violet-100'
                  : 'border-zinc-600 bg-zinc-900 text-zinc-300 hover:border-zinc-400'
              }`}
            >
              {row.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-2 overflow-x-auto">
        <BacktestBucketTable backtest={active} />
      </div>
      {active.note ? <p className="mt-3 text-xs text-zinc-500">{active.note}</p> : null}
    </section>
  );
}

function ForwardBucketPanel({ forwardTest }: { forwardTest?: PeGlassForwardTest }) {
  if (!forwardTest?.buckets?.length) return null;
  const buckets = [...forwardTest.buckets].sort(
    (a, b) => (b.summary?.totalReturnPct ?? -999) - (a.summary?.totalReturnPct ?? -999),
  );

  return (
    <section className="rounded-2xl border border-emerald-900/50 bg-zinc-950/70 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">Forward test</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">Live bucket portfolios</h2>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">{forwardTest.method}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="py-2 pr-3">Bucket</th>
              <th className="py-2 pr-3 text-right">Open</th>
              <th className="py-2 pr-3 text-right">Live avg</th>
              <th className="py-2 pr-3 text-right">Periods</th>
              <th className="py-2 pr-3 text-right">Fwd total</th>
              <th className="py-2 pr-3 text-right">Hit rate</th>
              <th className="py-2 pr-3">Top momentum names</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.key} className="border-b border-zinc-800/80">
                <td className="py-2 pr-3 font-semibold text-zinc-100">{bucket.label}</td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-300">{bucket.openCount ?? 0}</td>
                <td className={`py-2 pr-3 text-right font-mono ${classForScore(bucket.openAvgReturnPct)}`}>
                  {pct(bucket.openAvgReturnPct)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-500">{bucket.summary?.periodCount ?? 0}</td>
                <td className={`py-2 pr-3 text-right font-mono ${classForScore(bucket.summary?.totalReturnPct)}`}>
                  {pct(bucket.summary?.totalReturnPct)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(bucket.summary?.hitRatePct)}</td>
                <td className="py-2 pr-3 text-xs text-zinc-400">
                  {bucket.currentTickers?.length ? bucket.currentTickers.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Rebuilds on each trading-day slow refresh (after valuations), using price as-of like Core. First day
        seeds portfolios; later days record period returns between builds.
      </p>
    </section>
  );
}

function GlassCard({ row }: { row: PeGlassRow }) {
  const tone = verdictTone(row.verdict);
  const fill = row.earningsFillPct ?? 50;
  const bead = row.priceBeadPct ?? 50;
  const overflow = bead > fill + 8;
  const beadGap = bead - fill;
  const beadGapLabel =
    beadGap > 0 ? `${beadGap.toFixed(0)}pts above fill` : beadGap < 0 ? `${Math.abs(beadGap).toFixed(0)}pts below fill` : 'on fill';

  return (
    <article
      className={`relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-lg ring-1 ${tone.ring} ${tone.glow}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" title={row.animal}>
              {row.animalEmoji || '🦉'}
            </span>
            <TickerLink ticker={row.ticker} className="text-lg font-bold text-zinc-100 hover:text-emerald-300" />
          </div>
          {row.company ? <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{row.company}</p> : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            row.verdict === 'overflow' || row.verdict === 'stretched'
              ? 'bg-amber-950 text-amber-200'
              : row.verdict === 'room' || row.verdict === 'catching'
                ? 'bg-emerald-950 text-emerald-200'
                : 'bg-zinc-800 text-zinc-300'
          }`}
        >
          {row.verdictLabel}
        </span>
      </div>

      <div className="relative mx-auto h-44 w-28">
        <svg viewBox="0 0 120 180" className="h-full w-full drop-shadow-lg">
          <defs>
            <linearGradient id={`fill-${row.ticker}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#0e7490" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.85" />
            </linearGradient>
            <clipPath id={`clip-${row.ticker}`}>
              <path d="M34 28 H86 L78 150 Q60 168 42 150 Z" />
            </clipPath>
          </defs>
          {/* glass outline */}
          <path
            d="M32 24 H88 Q92 24 92 30 V142 Q92 158 60 172 Q28 158 28 142 V30 Q28 24 32 24 Z"
            fill="rgba(15,23,42,0.55)"
            stroke="rgba(161,161,170,0.55)"
            strokeWidth="2"
          />
          {/* earnings liquid */}
          <rect
            x="30"
            y={168 - (fill / 100) * 130}
            width="60"
            height={(fill / 100) * 130}
            fill={`url(#fill-${row.ticker})`}
            clipPath={`url(#clip-${row.ticker})`}
            opacity="0.92"
          />
          {/* shine */}
          <path d="M38 40 V130" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" />
          {/* price bead */}
          <circle cx="94" cy={168 - (bead / 100) * 130} r="7" fill={tone.bead} stroke="#18181b" strokeWidth="2" />
          <line
            x1="78"
            y1={168 - (bead / 100) * 130}
            x2="87"
            y2={168 - (bead / 100) * 130}
            stroke={tone.bead}
            strokeWidth="2"
            strokeDasharray="3 2"
          />
          {overflow ? (
            <>
              <path d="M48 32 L52 40 M70 30 L66 38" stroke="rgba(248,113,113,0.8)" strokeWidth="2" />
              <ellipse cx="60" cy="22" rx="14" ry="5" fill="none" stroke="rgba(248,113,113,0.5)" strokeWidth="2" />
            </>
          ) : null}
        </svg>
        <div className="pointer-events-none absolute bottom-1 left-0 right-0 text-center text-[10px] text-zinc-500">
          <span className="text-emerald-400/90">fill</span> earnings · <span className="text-amber-300/90">bead</span> price
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
        <div>
          <dt className="text-zinc-500">12m price</dt>
          <dd className="font-mono text-amber-200">{pct(row.price12mPct)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{row.earningsLabel?.includes('Sales') ? 'Sales' : 'EPS'}</dt>
          <dd className="font-mono text-emerald-300">{pct(row.earningsGrowthPct)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-zinc-500">Gap (P/E visual)</dt>
          <dd className="font-mono text-zinc-200">
            {row.stretchGapPct != null ? `${row.stretchGapPct >= 0 ? '+' : ''}${row.stretchGapPct.toFixed(1)}%` : '—'}
            <span className="text-zinc-500"> · bead {beadGapLabel}</span>
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs leading-relaxed text-zinc-400">{row.hint}</p>
    </article>
  );
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'overflow', label: 'Overflow / stretched' },
  { id: 'room', label: 'Room / catching up' },
  { id: 'balanced', label: 'Balanced' },
] as const;

export default function EarningsGlassClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<PeGlassPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/scanner/pe-glass', fetchInit);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setUser(json.user ?? null);
      setData(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'overflow') return rows.filter((r) => r.verdict === 'overflow' || r.verdict === 'stretched');
    if (filter === 'room') return rows.filter((r) => r.verdict === 'room' || r.verdict === 'catching');
    return rows.filter((r) => r.verdict === 'balanced' || r.verdict === 'unknown');
  }, [rows, filter]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/earnings-glass" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Pouring the glasses…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first.</p>
          <a href="/scanner" className="mt-4 inline-flex text-cyan-300 hover:text-cyan-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          <GlassLegend />
          <BacktestPanel backtest={data?.backtest} compare={data?.backtestCompare} />
          <ForwardBucketPanel forwardTest={data?.forwardTest} />

          {data?.summary?.headline ? (
            <section className="rounded-2xl border border-cyan-900/50 bg-gradient-to-br from-cyan-950/40 to-zinc-900 p-6">
              <h2 className="text-xl font-semibold text-cyan-100">Today&apos;s bar</h2>
              <p className="mt-2 text-zinc-300">{data.summary.headline}</p>
            </section>
          ) : null}

          <section className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                  filter === f.id
                    ? 'border-cyan-500 bg-cyan-950 text-cyan-100'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </section>

          {error ? <p className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</p> : null}
          {data?.message && !rows.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          {filtered.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((row) => (
                <GlassCard key={row.ticker} row={row} />
              ))}
            </div>
          ) : (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
              No glasses in this filter.
            </section>
          )}

          {data?.note ? <p className="text-sm text-zinc-500">{data.note}</p> : null}
          {data?.generatedAt ? (
            <p className="text-xs text-zinc-600">
              As of {data.asOf || 'n/a'} · built {new Date(data.generatedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
