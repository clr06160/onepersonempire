'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type { Top100Payload, Top100Row } from '@/lib/scanner-top100-data';
import { sortedRows, universeMeta, universeOptions } from '@/lib/top100-utils';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

type SortableField = keyof Pick<
  Top100Row,
  'weightedAlpha' | 'pct5d' | 'pct1m' | 'pct3m' | 'ytd' | 'pct52w' | 'pct2y' | 'pct3y' | 'pct5y' | 'pct10y'
>;

const PERF_COLUMNS: Array<{ key: SortableField; label: string }> = [
  { key: 'weightedAlpha', label: 'Wtd Alpha' },
  { key: 'pct5d', label: '5D' },
  { key: 'pct1m', label: '1M' },
  { key: 'pct3m', label: '3M' },
  { key: 'ytd', label: 'YTD' },
  { key: 'pct52w', label: '52W' },
  { key: 'pct2y', label: '2Y' },
  { key: 'pct3y', label: '3Y' },
  { key: 'pct5y', label: '5Y' },
  { key: 'pct10y', label: '10Y' },
];

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function price(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(2);
}

function growthClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-500';
  if (value >= 50) return 'text-emerald-300 font-semibold';
  if (value > 0) return 'text-emerald-400/90';
  if (value <= -25) return 'text-red-300 font-semibold';
  if (value < 0) return 'text-red-400/90';
  return 'text-zinc-300';
}

export default function Top100Client() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<Top100Payload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [universeKey, setUniverseKey] = useState('sp500');
  const [sortKey, setSortKey] = useState<SortableField>('ytd');
  const [ascending, setAscending] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/top100', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load the Top 100 leaderboard.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    const nextData = payload.data || null;
    setData(nextData);
    setUniverseKey(nextData?.defaultUniverse || nextData?.universe || 'sp500');
    setSortKey((nextData?.defaultSort as SortableField) || 'ytd');
    setAscending(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(
    () => sortedRows(data, universeKey, sortKey, ascending),
    [data, universeKey, sortKey, ascending],
  );
  const meta = useMemo(() => universeMeta(data, universeKey), [data, universeKey]);
  const universes = useMemo(() => universeOptions(data), [data]);

  const onSort = useCallback(
    (key: SortableField) => {
      if (key === sortKey) {
        setAscending((prev) => !prev);
      } else {
        setSortKey(key);
        setAscending(false);
      }
    },
    [sortKey],
  );

  const sortArrow = (key: SortableField) => {
    if (key !== sortKey) return '';
    return ascending ? ' ▲' : ' ▼';
  };

  return (
    <>
      <ScannerExtrasNav active="/scanner/top100" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading leaderboard...</section>
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
              <h2 className="text-2xl font-semibold">Top 100 Stocks</h2>
              <p className="text-sm text-zinc-400">
                {meta.label || data?.universeLabel || 'Universe'} · as of {data?.asOf || 'n/a'} · top{' '}
                {data?.topN || 100} by selected column
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
          </div>

          {error ? <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}

          {data?.message && !rows.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          {data?.note ? <p className="mb-4 text-sm text-zinc-500">{data.note}</p> : null}

          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-700 text-left text-zinc-400">
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Symbol</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3 text-right">Last</th>
                    {PERF_COLUMNS.map((col) => (
                      <th key={col.key} className="py-2 pr-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSort(col.key)}
                          className={`inline-flex items-center font-semibold transition hover:text-zinc-100 ${
                            col.key === sortKey ? 'text-emerald-300' : 'text-zinc-400'
                          }`}
                        >
                          {col.label}
                          {sortArrow(col.key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: Top100Row) => (
                    <tr key={`${universeKey}-${row.ticker}`} className="border-b border-zinc-800/80">
                      <td className="py-2 pr-3 text-zinc-500">{row.rank}</td>
                      <td className="py-2 pr-3">
                        <TickerLink ticker={row.ticker} />
                      </td>
                      <td className="py-2 pr-3 text-zinc-300">{row.company || '—'}</td>
                      <td className="py-2 pr-3 text-right font-mono text-zinc-300">{price(row.latest)}</td>
                      {PERF_COLUMNS.map((col) => (
                        <td
                          key={col.key}
                          className={`py-2 pr-3 text-right font-mono ${
                            col.key === sortKey ? 'bg-zinc-800/40' : ''
                          } ${growthClass(row[col.key])}`}
                        >
                          {pct(row[col.key])}
                        </td>
                      ))}
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
