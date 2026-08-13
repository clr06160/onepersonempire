'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ShortlistPayload, ShortlistPosition, ShortlistRow } from '@/lib/scanner-shortlist-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function score(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.round(value).toString();
}

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function returnClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-400';
  if (value >= 10) return 'text-emerald-300 font-semibold';
  if (value > 0) return 'text-emerald-400/90';
  if (value <= -10) return 'text-red-300 font-semibold';
  if (value < 0) return 'text-red-400/90';
  return 'text-zinc-300';
}

function flowClass(signal?: string) {
  const normalized = String(signal || 'MIXED').toUpperCase();
  if (normalized === 'ACCUMULATING') return 'text-emerald-300 font-semibold';
  if (normalized === 'MOSTLY ACCUMULATING') return 'text-emerald-400/90';
  if (normalized === 'DISTRIBUTING') return 'text-red-300 font-semibold';
  return 'text-zinc-400';
}

function animalClass(animal?: string) {
  if (!animal) return 'text-zinc-400';
  if (animal === 'Cheetah' || animal === 'Dragon') return 'text-emerald-300';
  if (animal === 'Owl' || animal === 'Turtle') return 'text-zinc-300';
  return 'text-amber-300';
}

function ShortlistTable({ rows, holdingTickers }: { rows: ShortlistRow[]; holdingTickers: Set<string> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">Ticker</th>
            <th className="px-3 py-2 font-semibold">Scan rank</th>
            <th className="px-3 py-2 font-semibold">Scans</th>
            <th className="px-3 py-2 font-semibold">6-wk setup</th>
            <th className="px-3 py-2 font-semibold">Runway</th>
            <th className="px-3 py-2 font-semibold">Risk</th>
            <th className="px-3 py-2 font-semibold">Animal</th>
            <th className="px-3 py-2 font-semibold">Flow</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.ticker}
              className={`border-b border-zinc-800/80 hover:bg-zinc-950/60 ${
                holdingTickers.has(row.ticker) ? 'bg-emerald-950/20' : ''
              }`}
            >
              <td className="px-3 py-3 text-zinc-500">{row.rank}</td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <TickerLink ticker={row.ticker} className="font-semibold text-emerald-300 hover:text-emerald-200" />
                  {holdingTickers.has(row.ticker) ? (
                    <span className="rounded-full border border-emerald-700 bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      Holding
                    </span>
                  ) : null}
                </div>
                {row.company ? <div className="text-xs text-zinc-500">{row.company}</div> : null}
              </td>
              <td className="px-3 py-3">{row.bestScanRank ?? '—'}</td>
              <td className="px-3 py-3">{row.scanCount ?? '—'}</td>
              <td className="px-3 py-3">{score(row.sixWeekSetupScore)}</td>
              <td className="px-3 py-3">{score(row.runwayScore)}</td>
              <td className="px-3 py-3">{score(row.musicStopsRisk)}</td>
              <td className={`px-3 py-3 ${animalClass(row.animal?.animal)}`}>{row.animal?.animal || '—'}</td>
              <td className={`px-3 py-3 ${flowClass(row.flowSignal)}`}>{row.flowSignal || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HoldingsTable({ positions }: { positions: ShortlistPosition[] }) {
  if (!positions.length) {
    return <p className="text-sm text-zinc-400">No open positions yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="px-3 py-2 font-semibold">Ticker</th>
            <th className="px-3 py-2 font-semibold">Entry</th>
            <th className="px-3 py-2 font-semibold">Last</th>
            <th className="px-3 py-2 font-semibold">Return</th>
            <th className="px-3 py-2 font-semibold">Days</th>
            <th className="px-3 py-2 font-semibold">Rank in</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.ticker} className="border-b border-zinc-800/80">
              <td className="px-3 py-3">
                <TickerLink ticker={pos.ticker} className="font-semibold text-emerald-300 hover:text-emerald-200" />
              </td>
              <td className="px-3 py-3 text-zinc-300">
                {pos.entryDate || '—'}
                {pos.entryPrice != null ? <div className="text-xs text-zinc-500">${pos.entryPrice.toFixed(2)}</div> : null}
              </td>
              <td className="px-3 py-3 text-zinc-300">
                {pos.lastDate || '—'}
                {pos.lastPrice != null ? <div className="text-xs text-zinc-500">${pos.lastPrice.toFixed(2)}</div> : null}
              </td>
              <td className={`px-3 py-3 ${returnClass(pos.currentReturnPct)}`}>{pct(pos.currentReturnPct)}</td>
              <td className="px-3 py-3">{pos.daysHeld ?? '—'}</td>
              <td className="px-3 py-3">{pos.entryShortlistRank ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TopTenClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ShortlistPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDisqualified, setShowDisqualified] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/shortlist', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load the Top Ten shortlist.');
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

  const forward = data?.forwardTest;
  const portfolio = useMemo(() => data?.portfolio || [], [data?.portfolio]);
  const survivors = useMemo(() => data?.rows || [], [data?.rows]);
  const disqualified = useMemo(() => data?.disqualified || [], [data?.disqualified]);
  const holdingTickers = useMemo(() => new Set(forward?.holdings || portfolio.map((row) => row.ticker)), [forward?.holdings, portfolio]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/top-ten" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading forward test...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          {!data?.connected ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-zinc-300">{data?.message || 'Shortlist data is not connected yet.'}</p>
            </section>
          ) : (
            <>
              <section className="rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">Forward paper test</p>
                    <h2 className="mt-2 text-3xl font-bold text-zinc-50">{money(forward?.equity)}</h2>
                    <p className={`mt-1 text-lg ${returnClass(forward?.totalReturnPct)}`}>{pct(forward?.totalReturnPct, 2)} total</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-zinc-500">Started</p>
                      <p className="font-semibold text-zinc-200">{forward?.startedAt || '—'}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Trading days</p>
                      <p className="font-semibold text-zinc-200">{forward?.tradingDays ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Max drawdown</p>
                      <p className="font-semibold text-zinc-200">{pct(forward?.maxDrawdownPct, 2)}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Closed trades</p>
                      <p className="font-semibold text-zinc-200">
                        {forward?.closedSummary?.count ?? 0}
                        {forward?.closedSummary?.hitRatePct != null ? (
                          <span className="ml-1 text-zinc-500">({forward.closedSummary.hitRatePct}% wins)</span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </div>
                {forward?.note ? <p className="mt-4 text-sm text-emerald-100/80">{forward.note}</p> : null}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-100">Full shortlist</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      {data.tickerCount}/{data.requestedTickerCount} passed vetoes · top 10 marked{' '}
                      <span className="text-emerald-300">Holding</span> in the forward test
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDisqualified((prev) => !prev)}
                    className="rounded-full border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-400"
                  >
                    {showDisqualified ? 'Hide' : 'Show'} disqualified ({disqualified.length})
                  </button>
                </div>

                {data.method?.length ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                    {data.method.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}

                <div className="mt-6">
                  <ShortlistTable rows={survivors} holdingTickers={holdingTickers} />
                </div>

                {showDisqualified ? (
                  <div className="mt-8 border-t border-zinc-800 pt-6">
                    <h3 className="text-lg font-semibold text-zinc-200">Disqualified</h3>
                    <p className="mt-1 text-sm text-zinc-400">Scan picks cut by the three hard vetoes.</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-zinc-700 text-left text-zinc-400">
                            <th className="px-3 py-2 font-semibold">Ticker</th>
                            <th className="px-3 py-2 font-semibold">Reasons</th>
                          </tr>
                        </thead>
                        <tbody>
                          {disqualified.map((row) => (
                            <tr key={row.ticker} className="border-b border-zinc-800/80">
                              <td className="px-3 py-3">
                                <TickerLink ticker={row.ticker} className="text-amber-300 hover:text-amber-200" />
                              </td>
                              <td className="px-3 py-3 text-red-300/90">{(row.reasons || []).join(' · ') || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-100">Live book — top 10</h2>
                    <p className="mt-1 text-sm text-zinc-400">
                      As of {data.asOf || '—'} · equal weight · hold while in top 10, replace when out
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <HoldingsTable positions={forward?.openPositions || []} />
                </div>
              </section>

              {(forward?.recentTrades?.length || forward?.recentClosed?.length) ? (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                  <h2 className="text-xl font-semibold text-zinc-100">Recent activity</h2>
                  {forward?.recentTrades?.length ? (
                    <div className="mt-4 space-y-2">
                      {forward.recentTrades.map((trade, index) => (
                        <div key={`${trade.date}-${trade.type}-${index}`} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm">
                          <p className="font-semibold text-zinc-200">
                            {trade.date} · {trade.type}
                          </p>
                          {trade.added?.length ? <p className="mt-1 text-emerald-300">Added: {trade.added.join(', ')}</p> : null}
                          {trade.removed?.length ? <p className="mt-1 text-red-300">Removed: {trade.removed.join(', ')}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {forward?.recentClosed?.length ? (
                    <div className="mt-6 overflow-x-auto">
                      <p className="mb-3 text-sm font-semibold text-zinc-300">Closed positions</p>
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-zinc-700 text-left text-zinc-400">
                            <th className="px-3 py-2 font-semibold">Ticker</th>
                            <th className="px-3 py-2 font-semibold">Held</th>
                            <th className="px-3 py-2 font-semibold">Return</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forward.recentClosed.map((pos) => (
                            <tr key={`${pos.ticker}-${pos.exitDate}`} className="border-b border-zinc-800/80">
                              <td className="px-3 py-3">
                                <TickerLink ticker={pos.ticker} className="text-zinc-200 hover:text-emerald-200" />
                              </td>
                              <td className="px-3 py-3 text-zinc-400">
                                {pos.entryDate} → {pos.exitDate}
                              </td>
                              <td className={`px-3 py-3 ${returnClass(pos.returnPct)}`}>{pct(pos.returnPct)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      )}

      {error ? <p className="mt-4 text-red-300">{error}</p> : null}
    </>
  );
}
