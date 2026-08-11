'use client';

import { useCallback, useEffect, useState } from 'react';

import type { BracketPayload, BracketRow } from '@/lib/scanner-bracket-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(n?: number | null, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function money(n?: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

function returnClass(n?: number | null) {
  if (n == null || Number.isNaN(n)) return 'text-zinc-400';
  if (n > 0) return 'text-emerald-300';
  if (n < 0) return 'text-red-300';
  return 'text-zinc-300';
}

function actionClass(action?: string) {
  if (action === 'BUY') return 'border-emerald-700/60 bg-emerald-950/40 text-emerald-200';
  if (action === 'SELL') return 'border-red-800/60 bg-red-950/35 text-red-200';
  if (action === 'WATCH') return 'border-amber-700/50 bg-amber-950/25 text-amber-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function CandidateCard({ row, side }: { row: BracketRow; side: 'buy' | 'sell' }) {
  const accent = side === 'buy' ? 'border-emerald-800/50' : 'border-red-900/50';
  return (
    <article className={`rounded-2xl border ${accent} bg-zinc-900/80 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <TickerLink ticker={row.ticker} className="text-xl font-bold text-zinc-100 hover:text-sky-300" />
          <p className="mt-1 text-xs text-zinc-500">
            Prior {row.priorDate || '—'} · width {pct(row.widthPct, 2).replace('+', '')}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${actionClass(row.action)}`}>
          {row.action}
          {row.failedBreakLong || row.failedBreakShort ? ' · fail' : ''}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">{row.actionDetail}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-5">
        <div>
          <p className="text-zinc-500">Low</p>
          <p className="font-mono text-zinc-200">{money(row.bracketLow)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Buy ≤</p>
          <p className="font-mono text-emerald-300">{money(row.buyCeiling)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Last</p>
          <p className="font-mono text-zinc-100">{money(row.last)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Sell ≥</p>
          <p className="font-mono text-red-300">{money(row.sellFloor)}</p>
        </div>
        <div>
          <p className="text-zinc-500">High</p>
          <p className="font-mono text-zinc-200">{money(row.bracketHigh)}</p>
        </div>
      </div>
    </article>
  );
}

function FocusCard({ row }: { row: BracketRow }) {
  return (
    <div className={`rounded-2xl border p-4 ${actionClass(row.action)}`}>
      <div className="flex items-center justify-between gap-2">
        <TickerLink ticker={row.ticker} className="text-lg font-bold hover:underline" />
        <span className="text-xs font-bold uppercase">{row.action}</span>
      </div>
      <p className="mt-2 text-sm opacity-90">{row.actionDetail}</p>
      <p className="mt-3 font-mono text-sm">
        {money(row.bracketLow)} — <span className="opacity-70">buy≤{money(row.buyCeiling)}</span> —{' '}
        <strong>{money(row.last)}</strong> — <span className="opacity-70">sell≥{money(row.sellFloor)}</span> —{' '}
        {money(row.bracketHigh)}
      </p>
    </div>
  );
}

export default function BracketClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<BracketPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/bracket', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || payload.message || 'Could not load Horizontal Bracket.');
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

  const regime = data?.regime;
  const forward = data?.forwardTest;
  const fit = String(regime?.fit || 'mixed').toLowerCase();
  const fitStyles =
    fit === 'favorable'
      ? 'border-emerald-700/50 bg-emerald-950/25'
      : fit === 'unfavorable'
        ? 'border-red-900/50 bg-red-950/20'
        : 'border-amber-800/40 bg-amber-950/20';

  return (
    <>
      <ScannerExtrasNav active="/scanner/bracket" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-sky-300 hover:text-sky-200">
            Go to scanner login
          </a>
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-red-300">{error}</section>
      ) : (
        <div className="space-y-6">
          {!data?.connected ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-zinc-300">{data?.message || 'Bracket data is not connected yet.'}</p>
            </section>
          ) : (
            <>
              <section className={`rounded-2xl border p-6 ${fitStyles}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Tape for brackets · as of {data.asOf || '—'}
                </p>
                <p className="mt-2 text-2xl font-bold text-zinc-100">{regime?.fitLabel || 'Mixed'}</p>
                <p className="mt-1 max-w-3xl text-sm text-zinc-300">{regime?.headline}</p>
                {regime?.reasons?.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                    {regime.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              {(data.focus || []).length ? (
                <section>
                  <h2 className="mb-3 text-lg font-semibold">Index boxes</h2>
                  <div className="grid gap-3 md:grid-cols-3">
                    {(data.focus || []).map((row) => (
                      <FocusCard key={row.ticker} row={row} />
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-2">
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-emerald-300">Best buy candidates</h2>
                  <p className="mb-3 text-sm text-zinc-500">
                    Lower third of prior-day box, or failed break of the low that reclaimed.
                  </p>
                  <div className="space-y-3">
                    {(data.buyCandidates || []).length ? (
                      (data.buyCandidates || []).map((row) => (
                        <CandidateCard key={`b-${row.ticker}`} row={row} side="buy" />
                      ))
                    ) : (
                      <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
                        No buy-zone names right now.
                      </p>
                    )}
                  </div>
                </section>
                <section>
                  <h2 className="mb-3 text-lg font-semibold text-red-300">Best sell candidates</h2>
                  <p className="mb-3 text-sm text-zinc-500">
                    Upper third of prior-day box, or failed break of the high that rejected.
                  </p>
                  <div className="space-y-3">
                    {(data.sellCandidates || []).length ? (
                      (data.sellCandidates || []).map((row) => (
                        <CandidateCard key={`s-${row.ticker}`} row={row} side="sell" />
                      ))
                    ) : (
                      <p className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-500">
                        No sell-zone names right now.
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Forward paper</p>
                <h2 className="mt-1 text-xl font-semibold">Overnight track</h2>
                <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                  {forward?.note ||
                    'Long prior buy list / short prior sell list overnight — proxy until we have minute fills.'}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-500">Days</p>
                    <p className="text-lg font-semibold">{forward?.totalDays ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Avg combo</p>
                    <p className={`text-lg font-semibold ${returnClass(forward?.avgComboOvernightPct)}`}>
                      {pct(forward?.avgComboOvernightPct, 2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-500">Hit rate</p>
                    <p className="text-lg font-semibold text-zinc-200">
                      {forward?.hitRatePct != null ? `${forward.hitRatePct}%` : '—'}
                    </p>
                  </div>
                </div>
                {(forward?.recent || []).length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-700 text-left text-zinc-500">
                          <th className="py-2 pr-3">As of</th>
                          <th className="py-2 pr-3">Buys</th>
                          <th className="py-2 pr-3">Sells</th>
                          <th className="py-2 pr-3 text-right">Combo ON</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(forward?.recent || []).map((day) => (
                          <tr key={day.asOf} className="border-b border-zinc-800/80">
                            <td className="py-2 pr-3 text-zinc-300">{day.asOf}</td>
                            <td className="py-2 pr-3 font-mono text-xs text-emerald-300/90">
                              {(day.buyTickers || []).slice(0, 6).join(' ')}
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs text-red-300/90">
                              {(day.sellTickers || []).slice(0, 6).join(' ')}
                            </td>
                            <td className={`py-2 pr-3 text-right font-mono ${returnClass(day.comboOvernightPct)}`}>
                              {pct(day.comboOvernightPct, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-amber-200/80">
                    Track starts after the next daily rebuild marks yesterday&apos;s lists.
                  </p>
                )}
              </section>

              {data.method?.length ? (
                <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <h2 className="mb-3 text-lg font-semibold">Rules</h2>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-400">
                    {data.method.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  {data.note ? <p className="mt-3 text-xs text-zinc-500">{data.note}</p> : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      )}
    </>
  );
}
