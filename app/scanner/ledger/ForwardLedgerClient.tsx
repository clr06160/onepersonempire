'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  ForwardLedgerAnalysis,
  ForwardLedgerPayload,
  ForwardLedgerTrade,
} from '@/lib/scanner-forward-ledger-types';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function returnClass(value?: number | null) {
  if (value == null || Number.isNaN(value)) return 'text-zinc-500';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-red-300';
  return 'text-zinc-300';
}

function severityClass(severity: string) {
  if (severity === 'high') return 'border-red-700/70 bg-red-950/40 text-red-100';
  if (severity === 'medium') return 'border-amber-700/60 bg-amber-950/30 text-amber-100';
  if (severity === 'low') return 'border-emerald-700/60 bg-emerald-950/30 text-emerald-100';
  return 'border-zinc-700 bg-zinc-900 text-zinc-200';
}

function AnalysisPanel({ analysis }: { analysis: ForwardLedgerAnalysis }) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Closed</p>
          <p className="mt-2 font-mono text-3xl font-semibold">{analysis.closedCount}</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Hit rate</p>
          <p className="mt-2 font-mono text-3xl font-semibold">
            {analysis.hitRatePct != null ? `${analysis.hitRatePct}%` : '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Avg return</p>
          <p className={`mt-2 font-mono text-3xl font-semibold ${returnClass(analysis.avgReturnPct)}`}>
            {pct(analysis.avgReturnPct)}
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Median</p>
          <p className={`mt-2 font-mono text-3xl font-semibold ${returnClass(analysis.medianReturnPct)}`}>
            {pct(analysis.medianReturnPct)}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400">
          Recommendations · {analysis.monthLabel || 'All time'}
        </p>
        <div className="mt-4 space-y-3">
          {analysis.recommendations.map((rec) => (
            <article key={rec.id} className={`rounded-xl border p-4 ${severityClass(rec.severity)}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {rec.severity}
                </span>
                {rec.systemId ? (
                  <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] opacity-80">
                    {rec.systemId}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1 text-base font-semibold">{rec.title}</h3>
              <p className="mt-1 text-sm leading-6 opacity-90">{rec.detail}</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 opacity-80">
                {rec.evidence.map((line) => (
                  <li key={line}>· {line}</li>
                ))}
              </ul>
              <p className="mt-3 text-sm font-medium">→ {rec.action}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <h2 className="text-lg font-semibold">By system</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">System</th>
                  <th className="px-2 py-2">n</th>
                  <th className="px-2 py-2">Hit</th>
                  <th className="px-2 py-2">Avg</th>
                </tr>
              </thead>
              <tbody>
                {analysis.bySystem.map((row) => (
                  <tr key={row.key} className="border-t border-zinc-800">
                    <td className="px-2 py-2">{row.label}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">{row.closedCount}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">
                      {row.hitRatePct != null ? `${row.hitRatePct}%` : '—'}
                    </td>
                    <td className={`px-2 py-2 font-mono ${returnClass(row.avgReturnPct)}`}>
                      {pct(row.avgReturnPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
          <h2 className="text-lg font-semibold">By tag</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-2 py-2">Tag</th>
                  <th className="px-2 py-2">n</th>
                  <th className="px-2 py-2">Hit</th>
                  <th className="px-2 py-2">Avg</th>
                </tr>
              </thead>
              <tbody>
                {analysis.byTag.map((row) => (
                  <tr key={row.key} className="border-t border-zinc-800">
                    <td className="px-2 py-2 font-mono text-xs">{row.label}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">{row.closedCount}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">
                      {row.hitRatePct != null ? `${row.hitRatePct}%` : '—'}
                    </td>
                    <td className={`px-2 py-2 font-mono ${returnClass(row.avgReturnPct)}`}>
                      {pct(row.avgReturnPct)}
                    </td>
                  </tr>
                ))}
                {!analysis.byTag.length ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3 text-zinc-500">
                      No tags yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function TradesTable({ trades }: { trades: ForwardLedgerTrade[] }) {
  if (!trades.length) {
    return <p className="text-sm text-zinc-500">No trades in this filter yet. Sync from forward tests.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2">System</th>
            <th className="px-3 py-2">Held</th>
            <th className="px-3 py-2">Return</th>
            <th className="px-3 py-2">Tags</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-t border-zinc-800/80 align-top">
              <td className="px-3 py-2">
                <a
                  href={`/scanner/charts?ticker=${encodeURIComponent(trade.ticker)}`}
                  className="font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {trade.ticker}
                </a>
                <p className="text-[11px] text-zinc-600">{trade.status}</p>
              </td>
              <td className="px-3 py-2 text-zinc-400">
                {trade.systemLabel}
                {trade.sleeve ? <p className="font-mono text-[11px] text-zinc-600">{trade.sleeve}</p> : null}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                {trade.entryDate}
                {trade.exitDate ? ` → ${trade.exitDate}` : ' → open'}
              </td>
              <td className={`px-3 py-2 font-mono ${returnClass(trade.returnPct)}`}>
                {pct(trade.returnPct)}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {trade.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ForwardLedgerClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ForwardLedgerPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [month, setMonth] = useState('');
  const [tab, setTab] = useState<'analysis' | 'trades'>('analysis');

  const load = useCallback(async (opts?: { sync?: boolean; month?: string }) => {
    const params = new URLSearchParams();
    if (opts?.month) params.set('month', opts.month);
    if (opts?.sync) params.set('sync', '1');
    const response = await fetch(`/api/scanner/ledger?${params.toString()}`, fetchInit);
    const payload = await response.json();
    setLoading(false);
    setSyncing(false);
    if (!response.ok) {
      setError(payload.error || payload.message || 'Could not load ledger.');
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

  const months = useMemo(() => {
    const keys = new Set((data?.trades || []).map((t) => t.monthKey).filter(Boolean));
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [data]);

  const filteredTrades = useMemo(() => {
    if (!month) return data?.trades || [];
    return (data?.trades || []).filter((t) => t.monthKey === month);
  }, [data, month]);

  const analysis = useMemo(() => {
    if (!month || !data?.analysis) return data?.analysis || null;
    // Client re-filter is approximate; prefer server when month selected via reload
    return data.analysis.monthKey === month || !data.analysis.monthKey ? data.analysis : data.analysis;
  }, [data, month]);

  const onSelectMonth = async (next: string) => {
    setMonth(next);
    setLoading(true);
    await load({ month: next || undefined });
  };

  const onSync = async () => {
    setSyncing(true);
    setLoading(true);
    const response = await fetch('/api/scanner/ledger', { ...fetchInit, method: 'POST' });
    const payload = await response.json();
    setSyncing(false);
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Sync failed.');
      return;
    }
    setData(payload.data || null);
    setError('');
  };

  return (
    <>
      <ScannerExtrasNav active="/scanner/ledger" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading ledger…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          {error ? (
            <p className="rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p>
          ) : null}

          <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">Scope</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onSelectMonth('')}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    !month
                      ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-400'
                  }`}
                >
                  All time
                </button>
                {months.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSelectMonth(key)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      month === key
                        ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('analysis')}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  tab === 'analysis'
                    ? 'border-cyan-500 bg-cyan-950 text-cyan-100'
                    : 'border-zinc-700 text-zinc-400'
                }`}
              >
                Analysis
              </button>
              <button
                type="button"
                onClick={() => setTab('trades')}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  tab === 'trades'
                    ? 'border-cyan-500 bg-cyan-950 text-cyan-100'
                    : 'border-zinc-700 text-zinc-400'
                }`}
              >
                Trades ({filteredTrades.length})
              </button>
              <button
                type="button"
                disabled={syncing}
                onClick={onSync}
                className="rounded-lg border border-emerald-700 bg-emerald-950/50 px-3 py-1.5 text-sm text-emerald-200 hover:border-emerald-500 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync from forward tests'}
              </button>
            </div>
          </section>

          {data?.sync?.errors?.length ? (
            <p className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-sm text-amber-100">
              Sync partial: {data.sync.errors.map((e) => `${e.systemId}: ${e.message}`).join(' · ')}
            </p>
          ) : null}

          {tab === 'analysis' && analysis ? <AnalysisPanel analysis={analysis} /> : null}
          {tab === 'analysis' && !analysis ? (
            <p className="text-zinc-500">No analysis yet — sync the ledger first.</p>
          ) : null}
          {tab === 'trades' ? <TradesTable trades={filteredTrades} /> : null}

          {analysis?.method?.length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4 text-xs leading-5 text-zinc-500">
              {analysis.method.map((line) => (
                <p key={line} className="mt-1">
                  {line}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
