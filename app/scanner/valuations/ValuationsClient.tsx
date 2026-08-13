'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type { ValuationForwardGroup, ValuationPayload, ValuationRow } from '@/lib/scanner-valuations-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const SORTS = [
  { key: 'sixWeekSetup', label: '6-Week Setup', ascending: false },
  { key: 'rank', label: 'Rank', ascending: true },
  { key: 'ticker', label: 'Ticker', ascending: true },
  { key: 'animal', label: 'Animal', ascending: true },
  { key: 'glass', label: 'Glass', ascending: false },
  { key: 'company', label: 'Company', ascending: true },
  { key: 'systems', label: 'Systems', ascending: true },
  { key: 'runwayScore', label: 'Runway score', ascending: false },
  { key: 'musicStopsRisk', label: 'Music stops risk', ascending: false },
  { key: 'targetUpsidePct', label: 'Analyst upside', ascending: false },
  { key: 'targetSpreadPct', label: 'Target spread', ascending: true },
  { key: 'forwardPe', label: 'Forward P/E', ascending: true },
  { key: 'forwardPeg', label: 'Forward PEG', ascending: true },
  { key: 'valuationStretchScore', label: 'Valuation stretch', ascending: false },
  { key: 'priceToSales', label: 'Price/Sales', ascending: true },
  { key: 'distanceFrom50dPct', label: '50D stretch', ascending: false },
  { key: 'return3mPct', label: '3M return', ascending: false },
  { key: 'drawdownFrom52wHighPct', label: '52W drawdown', ascending: false },
  { key: 'momentumStretchScore', label: 'Momentum stretch', ascending: false },
] as const;

type SortKey = (typeof SORTS)[number]['key'];

function numberOrNull(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return value;
}

function clamp(value: number, low: number, high: number) {
  return Math.max(low, Math.min(high, value));
}

function pct(value?: number | null) {
  const next = numberOrNull(value);
  if (next === null) return '—';
  return `${next >= 0 ? '+' : ''}${next.toFixed(1)}%`;
}

function multiple(value?: number | null) {
  const next = numberOrNull(value);
  if (next === null) return '—';
  return `${next.toFixed(1)}x`;
}

function score(value?: number | null) {
  const next = numberOrNull(value);
  if (next === null) return '—';
  return `${next.toFixed(0)}`;
}

function classForScore(value?: number | null, mode: 'goodHigh' | 'riskHigh' = 'goodHigh') {
  const next = numberOrNull(value);
  if (next === null) return 'text-zinc-500';
  if (mode === 'riskHigh') {
    if (next >= 75) return 'text-red-300 font-semibold';
    if (next >= 60) return 'text-amber-300 font-semibold';
    return 'text-emerald-300';
  }
  if (next >= 70) return 'text-emerald-300 font-semibold';
  if (next >= 50) return 'text-zinc-200';
  return 'text-amber-300';
}

function animalClass(animal?: string) {
  switch (animal) {
    case 'Cheetah':
      return 'border-emerald-700 bg-emerald-950/50 text-emerald-200';
    case 'Owl':
      return 'border-sky-700 bg-sky-950/40 text-sky-200';
    case 'Bear':
      return 'border-amber-700 bg-amber-950/50 text-amber-200';
    case 'Canary':
      return 'border-red-700 bg-red-950/60 text-red-200';
    case 'Turtle':
      return 'border-zinc-600 bg-zinc-900 text-zinc-200';
    case 'Dragon':
      return 'border-fuchsia-700 bg-fuchsia-950/40 text-fuchsia-200';
    default:
      return 'border-zinc-700 bg-zinc-900 text-zinc-200';
  }
}

function AnimalIcon({ animal, className = 'h-5 w-5' }: { animal?: string; className?: string }) {
  const positions: Record<string, string> = {
    Cheetah: '3% 50%',
    Owl: '22% 50%',
    Bear: '41% 50%',
    Canary: '60% 50%',
    Turtle: '78% 50%',
    Dragon: '97% 50%',
  };

  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full border border-white/20 bg-cover bg-center shadow-sm ${className}`}
      style={{
        backgroundImage: 'url(/scanner/valuation-animal-icons.png)',
        backgroundPosition: positions[animal || ''] || positions.Owl,
        backgroundSize: '620% auto',
      }}
    />
  );
}

function AnimalBadge({ row, compact = false }: { row?: ValuationRow; compact?: boolean }) {
  const animal = row?.animal?.animal;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border p-1 ${animalClass(animal)}`}
      title={animal || row?.animal?.label}
    >
      <AnimalIcon animal={animal} className={compact ? 'h-8 w-8' : 'h-10 w-10'} />
    </span>
  );
}

function RunwayGlass({ value, className = '' }: { value?: number | null; className?: string }) {
  const fill = clamp(numberOrNull(value) ?? 0, 0, 100);
  const fillClass = fill >= 70 ? 'bg-emerald-400' : fill >= 50 ? 'bg-amber-300' : 'bg-red-400';
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} title={`Runway glass: ${fill.toFixed(0)}% full`}>
      <div className="relative h-12 w-8 overflow-hidden rounded-b-xl rounded-t-md border-2 border-zinc-500 bg-zinc-950/70 shadow-inner">
        <div
          className={`absolute bottom-0 left-0 right-0 ${fillClass} opacity-80 transition-all`}
          style={{ height: `${fill}%` }}
        />
        <div className="absolute left-1 right-1 top-1 border-t border-white/25" />
      </div>
      <span className="font-mono text-sm text-zinc-300">{score(value)}</span>
    </div>
  );
}

function ValuationsLegend({
  activeAnimal,
  animalCounts,
  onAnimalClick,
}: {
  activeAnimal: string;
  animalCounts: Record<string, number>;
  onAnimalClick: (animal: string) => void;
}) {
  const animals = [
    ['Cheetah', 'strong runner with support'],
    ['Owl', 'balanced setup'],
    ['Bear', 'valuation/risk watch'],
    ['Canary', 'warning signal'],
    ['Turtle', 'low runway or slow setup'],
    ['Dragon', 'high-risk runner'],
  ];

  return (
    <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">How to use this page</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Start with the glass and animal. A fuller glass means more estimated runway left. Then check risk, forward
            valuation, analyst upside, and momentum stretch. This is a momentum-trader dashboard, not a buy/sell signal.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-200">Runway glass</span>
                <RunwayGlass value={72} />
              </div>
          <p className="mt-2 text-xs text-zinc-500">Fuller glass = more estimated upside/cushion.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-sm font-semibold text-zinc-200">Risk</p>
              <p className="mt-2 text-xs text-zinc-500">Higher music-stops risk means valuation, momentum, or analyst downside is stretched.</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
              <p className="text-sm font-semibold text-zinc-200">Val stretch</p>
              <p className="mt-2 text-xs text-zinc-500">Percentile-style score versus the stock&apos;s own valuation history.</p>
            </div>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Animal legend</p>
            <button
              type="button"
              onClick={() => onAnimalClick('all')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeAnimal === 'all'
                  ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              All animals · {Object.values(animalCounts).reduce((total, count) => total + count, 0)}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {animals.map(([animal, meaning]) => (
              <button
                key={animal}
                type="button"
                onClick={() => onAnimalClick(animal)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition hover:scale-[1.01] ${
                  animalClass(animal)
                } ${activeAnimal === animal ? 'ring-2 ring-emerald-400' : ''}`}
              >
                <AnimalIcon animal={animal} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{animal}</p>
                  <p className="text-xs opacity-75">{meaning}</p>
                </div>
                <span className="rounded-full border border-white/20 bg-black/25 px-2 py-1 text-xs font-semibold">
                  {animalCounts[animal] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function sortValue(row: ValuationRow, sortKey: SortKey) {
  switch (sortKey) {
    case 'sixWeekSetup':
      return sixWeekSetupScore(row);
    case 'rank':
      return row.rank;
    case 'ticker':
      return row.ticker;
    case 'animal':
      return row.animal?.animal;
    case 'glass':
      return row.scores?.runwayScore;
    case 'company':
      return row.company;
    case 'systems':
      return (row.systems || []).join(', ');
    case 'runwayScore':
      return row.scores?.runwayScore;
    case 'musicStopsRisk':
      return row.scores?.musicStopsRisk;
    case 'targetUpsidePct':
      return row.analyst?.targetUpsidePct;
    case 'targetSpreadPct':
      return row.analyst?.targetSpreadPct;
    case 'forwardPe':
      return row.analyst?.forwardPe;
    case 'forwardPeg':
      return row.analyst?.forwardPeg;
    case 'valuationStretchScore':
      return row.scores?.valuationStretchScore;
    case 'priceToSales':
      return row.valuation?.priceToSales;
    case 'distanceFrom50dPct':
      return row.price?.distanceFrom50dPct;
    case 'return3mPct':
      return row.price?.return3mPct;
    case 'drawdownFrom52wHighPct':
      return row.price?.drawdownFrom52wHighPct;
    case 'momentumStretchScore':
      return row.scores?.momentumStretchScore;
    default:
      return null;
  }
}

function sixWeekSetupScore(row: ValuationRow) {
  const runway = numberOrNull(row.scores?.runwayScore) ?? 50;
  const risk = numberOrNull(row.scores?.musicStopsRisk) ?? 50;
  const ret3m = numberOrNull(row.price?.return3mPct) ?? 0;
  const dist50 = numberOrNull(row.price?.distanceFrom50dPct) ?? 0;
  const targetUpside = numberOrNull(row.analyst?.targetUpsidePct) ?? 0;
  const valStretch = numberOrNull(row.scores?.valuationStretchScore) ?? 50;

  // Six-week momentum setup: reward strength and remaining upside, but penalize
  // names that are already very stretched above the 50d or flashing high risk.
  const momentum = clamp(50 + ret3m * 1.1, 0, 100);
  const healthy50d = clamp(100 - Math.abs(dist50 - 7) * 4, 0, 100);
  const upside = clamp(50 + targetUpside * 1.2, 0, 100);
  const riskControl = clamp(100 - risk, 0, 100);
  const valuationRoom = clamp(100 - valStretch, 0, 100);

  return (
    runway * 0.30 +
    momentum * 0.22 +
    healthy50d * 0.18 +
    upside * 0.15 +
    riskControl * 0.10 +
    valuationRoom * 0.05
  );
}

function uniqueSorted(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
}

function SummaryCard({
  label,
  row,
  value,
  valueClass = '',
}: {
  label: string;
  row?: ValuationRow;
  value?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      {row ? (
        <>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xl font-semibold text-zinc-100">{row.ticker}</span>
            <AnimalBadge row={row} compact />
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <p className={`text-2xl font-semibold ${valueClass}`}>{value}</p>
            <RunwayGlass value={row.scores?.runwayScore} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{row.company || row.note || ''}</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">No data yet</p>
      )}
    </div>
  );
}

function ForwardTestPanel({ groups, note }: { groups: ValuationForwardGroup[]; note?: string }) {
  const [kind, setKind] = useState('all');
  const visibleGroups = useMemo(
    () =>
      groups
        .filter((group) => kind === 'all' || group.kind === kind)
        .slice()
        .sort((a, b) => {
          const ar = a.open?.avgReturnPct ?? a.combined?.avgReturnPct ?? -999;
          const br = b.open?.avgReturnPct ?? b.combined?.avgReturnPct ?? -999;
          return br - ar;
        }),
    [groups, kind],
  );
  const kinds = useMemo(() => uniqueSorted(groups.map((group) => group.kind)), [groups]);

  if (!groups.length) return null;

  return (
    <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">Forward test</p>
          <h3 className="mt-1 text-xl font-semibold">Live membership buckets</h3>
          <p className="mt-1 max-w-4xl text-sm text-zinc-400">
            Enter when a stock qualifies for a bucket, exit when it falls out on a later valuation refresh.
            {note ? ` ${note}` : ''}
          </p>
        </div>
        <label className="flex flex-col gap-2 text-sm text-zinc-400">
          Bucket type
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="min-w-[220px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
          >
            <option value="all">All buckets</option>
            {kinds.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="py-2 pr-3">Bucket</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3 text-right">Open</th>
              <th className="py-2 pr-3 text-right">Closed</th>
              <th className="py-2 pr-3 text-right">Open Avg</th>
              <th className="py-2 pr-3 text-right">Closed Avg</th>
              <th className="py-2 pr-3 text-right">Hit Rate</th>
              <th className="py-2 pr-3">Open leaders</th>
            </tr>
          </thead>
          <tbody>
            {visibleGroups.map((group) => {
              const leaders = (group.openPositions || []).slice(0, 5);
              return (
                <tr key={group.key} className="border-b border-zinc-800/80">
                  <td className="py-2 pr-3 font-semibold text-zinc-100">{group.label}</td>
                  <td className="py-2 pr-3 text-zinc-500">{group.kind}</td>
                  <td className="py-2 pr-3 text-right font-mono text-zinc-300">{group.openCount ?? 0}</td>
                  <td className="py-2 pr-3 text-right font-mono text-zinc-300">{group.closedCount ?? 0}</td>
                  <td className={`py-2 pr-3 text-right font-mono ${classForScore(group.open?.avgReturnPct)}`}>
                    {pct(group.open?.avgReturnPct)}
                  </td>
                  <td className={`py-2 pr-3 text-right font-mono ${classForScore(group.closed?.avgReturnPct)}`}>
                    {pct(group.closed?.avgReturnPct)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(group.closed?.hitRatePct)}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-400">
                    {leaders.length
                      ? leaders.map((pos) => `${pos.ticker} ${pct(pos.currentReturnPct)}`).join(', ')
                      : 'No open members'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Early samples will mostly show open positions until enough refreshes occur for stocks to fall out of buckets.
      </p>
    </div>
  );
}

function SortHeader({
  label,
  sortId,
  activeSort,
  ascending,
  onSort,
  align = 'right',
}: {
  label: string;
  sortId: SortKey;
  activeSort: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sortId === activeSort;
  return (
    <th className={`py-2 pr-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(sortId)}
        className={`inline-flex items-center gap-1 font-semibold transition hover:text-zinc-100 ${
          active ? 'text-emerald-300' : 'text-zinc-400'
        }`}
      >
        {label}
        {active ? <span>{ascending ? '▲' : '▼'}</span> : <span className="text-zinc-700">↕</span>}
      </button>
    </th>
  );
}

export default function ValuationsClient() {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ValuationPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('sixWeekSetup');
  const [sortAscending, setSortAscending] = useState(false);
  const [sector, setSector] = useState('all');
  const [system, setSystem] = useState('all');
  const [animal, setAnimal] = useState('all');
  const [selectedTicker, setSelectedTicker] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/valuations', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load valuations.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    const nextData = payload.data || null;
    setData(nextData);
    setSelectedTicker((current) => current || nextData?.rows?.[0]?.ticker || '');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const baseRows = useMemo(() => data?.rows || [], [data?.rows]);
  const sectors = useMemo(() => uniqueSorted(baseRows.map((row) => row.sector)), [baseRows]);
  const systems = useMemo(() => uniqueSorted(baseRows.flatMap((row) => row.systems || [])), [baseRows]);
  const animals = useMemo(() => uniqueSorted(baseRows.map((row) => row.animal?.animal)), [baseRows]);
  const animalCounts = useMemo(
    () =>
      baseRows.reduce<Record<string, number>>((counts, row) => {
        const key = row.animal?.animal;
        if (key) counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
    [baseRows],
  );

  const rows = useMemo(() => {
    return baseRows
      .filter((row) => sector === 'all' || row.sector === sector)
      .filter((row) => animal === 'all' || row.animal?.animal === animal)
      .filter((row) => system === 'all' || (row.systems || []).includes(system))
      .slice()
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        const aMissing = av === null || av === undefined || Number.isNaN(av);
        const bMissing = bv === null || bv === undefined || Number.isNaN(bv);
        if (aMissing && bMissing) return a.ticker.localeCompare(b.ticker);
        if (aMissing) return 1;
        if (bMissing) return -1;
        if (typeof av === 'string' || typeof bv === 'string') {
          const result = String(av).localeCompare(String(bv));
          return sortAscending ? result : -result;
        }
        return sortAscending ? av - bv : bv - av;
      });
  }, [animal, baseRows, sector, sortAscending, sortKey, system]);

  const handleSort = useCallback(
    (key: SortKey) => {
      const sort = SORTS.find((item) => item.key === key) || SORTS[0];
      if (key === sortKey) {
        setSortAscending((prev) => !prev);
      } else {
        setSortKey(key);
        setSortAscending(sort.ascending);
      }
    },
    [sortKey],
  );
  const syncTopScroll = useCallback(() => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  }, []);
  const syncTableScroll = useCallback(() => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }, []);

  const selected = rows.find((row) => row.ticker === selectedTicker) || rows[0];
  const bestRunway = useMemo(
    () => baseRows.slice().sort((a, b) => (b.scores?.runwayScore || 0) - (a.scores?.runwayScore || 0))[0],
    [baseRows],
  );
  const highestRisk = useMemo(
    () => baseRows.slice().sort((a, b) => (b.scores?.musicStopsRisk || 0) - (a.scores?.musicStopsRisk || 0))[0],
    [baseRows],
  );
  const mostUpside = useMemo(
    () => baseRows.slice().sort((a, b) => (b.analyst?.targetUpsidePct || -999) - (a.analyst?.targetUpsidePct || -999))[0],
    [baseRows],
  );
  const mostStretched = useMemo(
    () =>
      baseRows
        .slice()
        .sort((a, b) => (b.scores?.valuationStretchScore || 0) - (a.scores?.valuationStretchScore || 0))[0],
    [baseRows],
  );

  return (
    <>
      <ScannerExtrasNav active="/scanner/valuations" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading valuations...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Scan-Only Valuations</h2>
              <p className="text-sm text-zinc-400">
                {data?.tickerCount || 0} scan tickers · as of {data?.asOf || 'n/a'} · sorted by{' '}
                {SORTS.find((item) => item.key === sortKey)?.label || sortKey}
              </p>
              <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
            </div>
            {data?.generatedAt ? (
              <span className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
            ) : null}
          </div>

          {error ? <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}
          {data?.message && !baseRows.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          {baseRows.length ? (
            <>
              <ValuationsLegend activeAnimal={animal} animalCounts={animalCounts} onAnimalClick={setAnimal} />

              <div className="mb-5 grid gap-3 md:grid-cols-4">
                <SummaryCard
                  label="Best runway"
                  row={bestRunway}
                  value={score(bestRunway?.scores?.runwayScore)}
                  valueClass={classForScore(bestRunway?.scores?.runwayScore)}
                />
                <SummaryCard
                  label="Most analyst upside"
                  row={mostUpside}
                  value={pct(mostUpside?.analyst?.targetUpsidePct)}
                  valueClass={classForScore(mostUpside?.analyst?.targetUpsidePct)}
                />
                <SummaryCard
                  label="Most stretched"
                  row={mostStretched}
                  value={score(mostStretched?.scores?.valuationStretchScore)}
                  valueClass={classForScore(mostStretched?.scores?.valuationStretchScore, 'riskHigh')}
                />
                <SummaryCard
                  label="Highest risk"
                  row={highestRisk}
                  value={score(highestRisk?.scores?.musicStopsRisk)}
                  valueClass={classForScore(highestRisk?.scores?.musicStopsRisk, 'riskHigh')}
                />
              </div>

              {data?.forwardTest?.groups?.length ? (
                <ForwardTestPanel groups={data.forwardTest.groups} note={data.forwardTest.note} />
              ) : null}

              <div className="mb-5 grid gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-2 text-sm text-zinc-400">
                  Sort
                  <select
                    value={sortKey}
                    onChange={(event) => handleSort(event.target.value as SortKey)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                  >
                    {SORTS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-zinc-400">
                  Animal
                  <select
                    value={animal}
                    onChange={(event) => setAnimal(event.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                  >
                    <option value="all">All animals</option>
                    {animals.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-zinc-400">
                  Sector
                  <select
                    value={sector}
                    onChange={(event) => setSector(event.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                  >
                    <option value="all">All sectors</option>
                    {sectors.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm text-zinc-400">
                  System
                  <select
                    value={system}
                    onChange={(event) => setSystem(event.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                  >
                    <option value="all">All systems</option>
                    {systems.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selected ? (
                <div className={`mb-5 rounded-2xl border p-4 ${animalClass(selected.animal?.animal)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] opacity-70">Selected animal read</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <AnimalIcon animal={selected.animal?.animal} className="h-14 w-14" />
                        <h3 className="text-2xl font-semibold">
                          {selected.animal?.animal || 'Animal'} · {selected.ticker}
                        </h3>
                      </div>
                      <p className="mt-1 max-w-4xl text-sm opacity-90">{selected.note}</p>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-right text-sm">
                      <div>
                        <p className="text-xs opacity-70">Glass</p>
                        <RunwayGlass value={selected.scores?.runwayScore} className="justify-end" />
                      </div>
                      <div>
                        <p className="text-xs opacity-70">Runway</p>
                        <p className="text-xl font-semibold">{score(selected.scores?.runwayScore)}</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-70">Risk</p>
                        <p className="text-xl font-semibold">{score(selected.scores?.musicStopsRisk)}</p>
                      </div>
                      <div>
                        <p className="text-xs opacity-70">Target upside</p>
                        <p className="text-xl font-semibold">{pct(selected.analyst?.targetUpsidePct)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {data?.note ? <p className="mb-4 text-sm text-zinc-500">{data.note}</p> : null}

              <div
                ref={topScrollRef}
                onScroll={syncTopScroll}
                className="mb-2 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/70"
                aria-label="Scroll valuation table horizontally"
              >
                <div className="h-3 min-w-[1650px]" />
              </div>

              <div ref={tableScrollRef} onScroll={syncTableScroll} className="overflow-x-auto">
                <table className="w-full min-w-[1650px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-zinc-400">
                      <SortHeader label="#" sortId="rank" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} align="left" />
                      <SortHeader label="Ticker" sortId="ticker" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} align="left" />
                      <SortHeader label="Animal" sortId="animal" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} align="left" />
                      <SortHeader label="Glass" sortId="glass" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Company" sortId="company" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} align="left" />
                      <SortHeader label="Systems" sortId="systems" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} align="left" />
                      <SortHeader label="6W Setup" sortId="sixWeekSetup" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Runway" sortId="runwayScore" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Risk" sortId="musicStopsRisk" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Fwd P/E" sortId="forwardPe" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Fwd PEG" sortId="forwardPeg" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Target Upside" sortId="targetUpsidePct" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Target Spread" sortId="targetSpreadPct" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="Val Stretch" sortId="valuationStretchScore" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="P/S" sortId="priceToSales" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="50D" sortId="distanceFrom50dPct" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="3M" sortId="return3mPct" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <SortHeader label="52W DD" sortId="drawdownFrom52wHighPct" activeSort={sortKey} ascending={sortAscending} onSort={handleSort} />
                      <th className="py-2 pr-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.ticker}
                        className={`border-b border-zinc-800/80 ${row.ticker === selected?.ticker ? 'bg-zinc-800/50' : ''}`}
                      >
                        <td className="py-2 pr-3 text-zinc-500">{row.rank}</td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <TickerLink ticker={row.ticker} />
                            <button
                              type="button"
                              onClick={() => setSelectedTicker(row.ticker)}
                              className="rounded-full border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:border-emerald-500 hover:text-emerald-200"
                            >
                              inspect
                            </button>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <AnimalBadge row={row} compact />
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <RunwayGlass value={row.scores?.runwayScore} className="justify-end" />
                        </td>
                        <td className="py-2 pr-3 text-zinc-300">{row.company || '—'}</td>
                        <td className="py-2 pr-3 text-zinc-400">{(row.systems || []).slice(0, 2).join(', ') || '—'}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${classForScore(sixWeekSetupScore(row))}`}>
                          {score(sixWeekSetupScore(row))}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${classForScore(row.scores?.runwayScore)}`}>
                          {score(row.scores?.runwayScore)}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${classForScore(
                            row.scores?.musicStopsRisk,
                            'riskHigh',
                          )}`}
                        >
                          {score(row.scores?.musicStopsRisk)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{multiple(row.analyst?.forwardPe)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{row.analyst?.forwardPeg ?? '—'}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${classForScore(row.analyst?.targetUpsidePct)}`}>
                          {pct(row.analyst?.targetUpsidePct)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(row.analyst?.targetSpreadPct)}</td>
                        <td
                          className={`py-2 pr-3 text-right font-mono ${classForScore(
                            row.scores?.valuationStretchScore,
                            'riskHigh',
                          )}`}
                        >
                          {score(row.scores?.valuationStretchScore)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{multiple(row.valuation?.priceToSales)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(row.price?.distanceFrom50dPct)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(row.price?.return3mPct)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                          {pct(row.price?.drawdownFrom52wHighPct)}
                        </td>
                        <td className="max-w-[320px] py-2 pr-3 text-xs text-zinc-500">{row.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      )}
    </>
  );
}
