'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type { CupHandleBreakout, CupHandlePayload, CupHandleUniverse } from '@/lib/scanner-cup-handle-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function num(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function signClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-500';
  if (value > 0) return 'text-emerald-400/90';
  if (value < 0) return 'text-red-400/90';
  return 'text-zinc-300';
}

export default function CupHandleClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<CupHandlePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [universeFilter, setUniverseFilter] = useState('all');
  const [actionableOnly, setActionableOnly] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/cup-handle', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load the Cup with Handle scan.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData(payload.data || null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const universes = useMemo<CupHandleUniverse[]>(() => data?.universes || [], [data]);

  const breakoutUniverses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of data?.recentBreakouts || []) {
      if (b.universeKey && !seen.has(b.universeKey)) seen.set(b.universeKey, b.universe || b.universeKey);
    }
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [data]);

  const breakouts = useMemo<CupHandleBreakout[]>(() => {
    let rows = data?.recentBreakouts || [];
    if (universeFilter !== 'all') rows = rows.filter((b) => b.universeKey === universeFilter);
    if (actionableOnly) rows = rows.filter((b) => b.actionable);
    return rows;
  }, [data, universeFilter, actionableOnly]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/cup-handle" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading cup with handle scan...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <>
          {error ? (
            <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p>
          ) : null}

          {data?.message && !universes.length && !breakouts.length ? (
            <p className="mb-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">5-year backtest by universe</h2>
                <p className="text-sm text-zinc-400">
                  Buy the pivot, strategy vs. benchmark buy-and-hold
                  {data?.windowStart ? ` · since ${data.windowStart}` : ''}
                  {data?.years ? ` · ${data.years}y window` : ''}
                </p>
                <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
              </div>
              {data?.generatedAt ? (
                <span className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
              ) : null}
            </div>

            {universes.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-zinc-400">
                      <th className="py-2 pr-3">Universe</th>
                      <th className="py-2 pr-3 text-right">Trades</th>
                      <th className="py-2 pr-3 text-right">Win %</th>
                      <th className="py-2 pr-3 text-right">Avg ret</th>
                      <th className="py-2 pr-3 text-right">Profit factor</th>
                      <th className="py-2 pr-3 text-right">Avg days</th>
                      <th className="py-2 pr-3 text-right">Strat CAGR</th>
                      <th className="py-2 pr-3 text-right">Bench CAGR</th>
                      <th className="py-2 pr-3 text-right">Strat total</th>
                      <th className="py-2 pr-3 text-right">Max DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {universes.map((u) => (
                      <tr key={u.key} className="border-b border-zinc-800/80">
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-zinc-100">{u.label}</span>
                          <span className="ml-2 text-xs text-zinc-500">vs {u.benchmark}</span>
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{u.trades}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{pct(u.winRatePct)}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(u.avgReturnPct)}`}>{pct(u.avgReturnPct)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{num(u.profitFactor)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{num(u.avgDaysHeld, 0)}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(u.strategyCagrPct)}`}>{pct(u.strategyCagrPct)}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(u.benchCagrPct)}`}>{pct(u.benchCagrPct)}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(u.strategyTotalPct)}`}>{pct(u.strategyTotalPct)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-red-400/90">{pct(u.strategyMaxDdPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No backtest results yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold">Recent breakouts</h2>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  Universe
                  <select
                    value={universeFilter}
                    onChange={(event) => setUniverseFilter(event.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
                  >
                    <option value="all">All</option>
                    {breakoutUniverses.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={actionableOnly}
                    onChange={(event) => setActionableOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-950"
                  />
                  Actionable only
                </label>
              </div>
            </div>

            {breakouts.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-zinc-400">
                      <th className="py-2 pr-3">Symbol</th>
                      <th className="py-2 pr-3">Universe</th>
                      <th className="py-2 pr-3">Breakout</th>
                      <th className="py-2 pr-3 text-right">Pivot</th>
                      <th className="py-2 pr-3 text-right">Last</th>
                      <th className="py-2 pr-3 text-right">% vs pivot</th>
                      <th className="py-2 pr-3 text-right">Vol ratio</th>
                      <th className="py-2 pr-3 text-right">RS vs bench</th>
                      <th className="py-2 pr-3 text-right">Days since</th>
                      <th className="py-2 pr-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakouts.map((b) => (
                      <tr key={`${b.universeKey}-${b.ticker}-${b.breakoutDate}`} className="border-b border-zinc-800/80">
                        <td className="py-2 pr-3">
                          <TickerLink ticker={b.ticker} />
                        </td>
                        <td className="py-2 pr-3 text-zinc-400">{b.universe}</td>
                        <td className="py-2 pr-3 text-zinc-300">{b.breakoutDate}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{num(b.pivot)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{num(b.lastClose)}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(b.pctFromPivot)}`}>{pct(b.pctFromPivot)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{num(b.volRatio)}</td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(b.rsVsBenchPct)}`}>{pct(b.rsVsBenchPct)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-400">{num(b.daysSinceBreakout, 0)}</td>
                        <td className="py-2 pr-3 text-right">
                          {b.actionable ? (
                            <span className="rounded-full border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-xs font-semibold text-emerald-200">
                              Actionable
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-500">Extended</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No breakouts match the current filters.</p>
            )}

            {data?.methodology?.length ? (
              <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="mb-2 text-sm font-semibold text-zinc-300">Methodology</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                  {data.methodology.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data?.note ? <p className="mt-4 text-sm text-zinc-500">{data.note}</p> : null}
          </section>
        </>
      )}
    </>
  );
}
