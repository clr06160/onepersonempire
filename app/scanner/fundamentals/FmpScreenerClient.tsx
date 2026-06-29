'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type { FmpScreenerPayload, FmpScreenerRow } from '@/lib/scanner-fmp-data';
import { sortedRows, sortOptions, universeMeta, universeOptions } from '@/lib/fmp-screener-utils';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function growthClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (value >= 30) return 'text-emerald-300 font-semibold';
  if (value > 0) return 'text-emerald-400/90';
  if (value <= -10) return 'text-red-300 font-semibold';
  if (value < 0) return 'text-red-400/90';
  return '';
}

function rule40Class(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (value >= 60) return 'bg-emerald-950/70 text-emerald-200 font-semibold';
  if (value >= 40) return 'bg-emerald-950/40 text-emerald-300';
  return '';
}

function reactionClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (value >= 5) return 'bg-amber-950/60 text-amber-200 font-semibold';
  if (value >= 3) return 'text-emerald-300 font-semibold';
  return '';
}

export default function FmpScreenerClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<FmpScreenerPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [universeKey, setUniverseKey] = useState('nasdaq100');
  const [sortKey, setSortKey] = useState('combined');

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/fundamentals', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load the fundamentals screener.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    const nextData = payload.data || null;
    setData(nextData);
    setUniverseKey(nextData?.defaultUniverse || nextData?.universe || 'nasdaq100');
    setSortKey(nextData?.defaultSort || nextData?.sortKey || 'combined');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => sortedRows(data, universeKey, sortKey), [data, universeKey, sortKey]);
  const meta = useMemo(() => universeMeta(data, universeKey), [data, universeKey]);
  const sorts = useMemo(() => sortOptions(data), [data]);
  const universes = useMemo(() => universeOptions(data), [data]);
  const activeSortLabel = sorts.find((option) => option.key === sortKey)?.label || sortKey;

  return (
    <>
      <ScannerExtrasNav active="/scanner/fundamentals" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading screener...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Proprietary Fundamentals</h2>
              <p className="text-sm text-zinc-400">
                {meta.label || data?.universeLabel || 'Universe'} · sorted by {activeSortLabel} · as of{' '}
                {data?.asOf || 'n/a'} · {meta.tickerCount || data?.tickerCount || 0} names screened, top{' '}
                {data?.topN || 30} shown
              </p>
              <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
            </div>
            {data?.generatedAt ? (
              <span className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
            ) : null}
          </div>

          <div className="mb-4 flex flex-wrap gap-4">
            <label className="flex flex-col gap-2 text-sm text-zinc-400">
              Stock universe
              <select
                value={universeKey}
                onChange={(event) => setUniverseKey(event.target.value)}
                className="min-w-[280px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
              >
                {universes.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-zinc-400">
              Sort by
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value)}
                className="min-w-[320px] rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
              >
                {sorts.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}

          {data?.message && !rows.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          {data?.note ? <p className="mb-4 text-sm text-zinc-500">{data.note}</p> : null}

          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-left text-zinc-400">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Ticker</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Rule 40</th>
                    <th className="py-2 pr-3">Net Inc Gr</th>
                    <th className="py-2 pr-3">Combined</th>
                    <th className="py-2 pr-3">Sales Gr</th>
                    <th className="py-2 pr-3">EPS Gr</th>
                    <th className="py-2 pr-3">FCF Gr</th>
                    <th className="py-2 pr-3">GM Exp</th>
                    <th className="py-2 pr-3">Rev (B)</th>
                    <th className="py-2 pr-3">Mkt Cap (B)</th>
                    <th className="py-2 pr-3">Immediate</th>
                    <th className="py-2 pr-3">3-Day</th>
                    <th className="py-2 pr-3">React Score</th>
                    <th className="py-2 pr-3">Last EPS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: FmpScreenerRow) => (
                    <tr key={`${universeKey}-${sortKey}-${row.ticker}`} className="border-b border-zinc-800/80">
                      <td className="py-2 pr-3 text-zinc-500">{row.rank}</td>
                      <td className="py-2 pr-3 font-semibold text-emerald-200">{row.ticker}</td>
                      <td className="py-2 pr-3 text-zinc-300">{row.company || '—'}</td>
                      <td className={`py-2 pr-3 ${rule40Class(row.rule40)}`}>{pct(row.rule40)}</td>
                      <td className={`py-2 pr-3 ${growthClass(row.netIncomeGrowthPct)}`}>{pct(row.netIncomeGrowthPct)}</td>
                      <td className="py-2 pr-3 font-medium">{row.combinedScore ?? '—'}</td>
                      <td className={`py-2 pr-3 ${growthClass(row.salesGrowthPct)}`}>{pct(row.salesGrowthPct)}</td>
                      <td className={`py-2 pr-3 ${growthClass(row.epsGrowthPct)}`}>{pct(row.epsGrowthPct)}</td>
                      <td className={`py-2 pr-3 ${growthClass(row.fcfGrowthPct)}`}>{pct(row.fcfGrowthPct)}</td>
                      <td className={`py-2 pr-3 ${growthClass(row.grossMarginExpansionPct)}`}>
                        {pct(row.grossMarginExpansionPct)}
                      </td>
                      <td className="py-2 pr-3">{row.latestRevenueB ?? '—'}</td>
                      <td className="py-2 pr-3">{row.marketCapB ?? '—'}</td>
                      <td className={`py-2 pr-3 ${growthClass(row.immediateReactionPct)}`}>
                        {pct(row.immediateReactionPct)}
                      </td>
                      <td className={`py-2 pr-3 ${growthClass(row.threeDayReactionPct)}`}>
                        {pct(row.threeDayReactionPct)}
                      </td>
                      <td className={`py-2 pr-3 ${reactionClass(row.earningsReactionScore)}`}>
                        {row.earningsReactionScore ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-zinc-400">{row.latestEarningsDate || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}
    </>
  );
}
