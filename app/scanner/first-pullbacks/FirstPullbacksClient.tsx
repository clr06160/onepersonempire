'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import FirstPullbackRegimeCard from '@/components/scanner/FirstPullbackRegimeCard';
import type {
  FirstPullbackBook,
  FirstPullbackPayload,
  FirstPullbackRow,
} from '@/lib/scanner-first-pullback-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(n?: number | null, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function returnClass(n?: number | null) {
  if (n == null || Number.isNaN(n)) return 'text-zinc-400';
  if (n > 0) return 'text-emerald-300';
  if (n < 0) return 'text-red-300';
  return 'text-zinc-300';
}

function ForwardPanel({ book, method }: { book?: FirstPullbackBook; method?: string }) {
  if (!book) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <p className="text-sm text-zinc-400">Forward paper seeds on the first PC rebuild.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-900/50 bg-amber-950/15 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">Forward paper</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">{book.label || 'FP → accel top 10'}</h2>
      {method ? <p className="mt-2 max-w-4xl text-sm text-zinc-400">{method}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-zinc-500">Fwd total</p>
          <p className={`text-lg font-semibold ${returnClass(book.summary?.totalReturnPct)}`}>
            {pct(book.summary?.totalReturnPct, 2)}
          </p>
        </div>
        <div>
          <p className="text-zinc-500">Periods</p>
          <p className="text-lg font-semibold text-zinc-200">{book.summary?.periodCount ?? 0}</p>
        </div>
        <div>
          <p className="text-zinc-500">Hit rate</p>
          <p className="text-lg font-semibold text-zinc-200">{pct(book.summary?.hitRatePct, 0)}</p>
        </div>
        <div>
          <p className="text-zinc-500">Open avg mark</p>
          <p className={`text-lg font-semibold ${returnClass(book.openAvgReturnPct)}`}>
            {pct(book.openAvgReturnPct, 2)}
          </p>
        </div>
      </div>
      {book.rebalancedToday ? (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-300">Rebalanced this refresh</p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Last</th>
              <th className="px-3 py-2">Open P&amp;L</th>
              <th className="px-3 py-2">Accel 20</th>
            </tr>
          </thead>
          <tbody>
            {(book.holdings || []).map((h) => (
              <tr key={h.ticker} className="border-b border-zinc-800/80">
                <td className="px-3 py-3 text-zinc-500">{h.rank ?? '—'}</td>
                <td className="px-3 py-3">
                  <TickerLink ticker={h.ticker} className="font-semibold text-amber-300 hover:text-amber-200" />
                </td>
                <td className="px-3 py-3 text-zinc-300">
                  {h.entryDate || '—'}
                  {h.entryPrice != null ? (
                    <div className="text-xs text-zinc-500">${h.entryPrice.toFixed(2)}</div>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-zinc-300">
                  {h.lastPrice != null ? `$${h.lastPrice.toFixed(2)}` : '—'}
                </td>
                <td className={`px-3 py-3 font-mono ${returnClass(h.openReturnPct)}`}>{pct(h.openReturnPct)}</td>
                <td className="px-3 py-3 font-mono text-zinc-300">{pct(h.accel20Pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(book.recentPeriods || []).length ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-zinc-300">Recent month periods</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {book.recentPeriods!.map((p) => (
              <li key={`${p.from}-${p.to}`}>
                {p.from} → {p.to}:{' '}
                <span className={`font-mono ${returnClass(p.returnPct)}`}>{pct(p.returnPct)}</span>
                {p.tickers?.length ? (
                  <span className="text-zinc-600"> · {p.tickers.slice(0, 6).join(', ')}
                    {p.tickers.length > 6 ? '…' : ''}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-zinc-500">
          First rebuild seeds the book — period returns appear after the next month rollover.
        </p>
      )}
    </section>
  );
}

function PoolTable({ rows }: { rows: FirstPullbackRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-400">No first-pullback names in the current 20-session window.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-700 text-left text-zinc-400">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">Ticker</th>
            <th className="px-3 py-2">Signal</th>
            <th className="px-3 py-2">Thrust</th>
            <th className="px-3 py-2">Retrace</th>
            <th className="px-3 py-2">Accel 20</th>
            <th className="px-3 py-2">ROC 20</th>
            <th className="px-3 py-2">Book</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.ticker}
              className={`border-b border-zinc-800/80 ${row.inTopBook ? 'bg-amber-950/20' : ''}`}
            >
              <td className="px-3 py-3 text-zinc-500">{row.rank}</td>
              <td className="px-3 py-3">
                <TickerLink ticker={row.ticker} className="font-semibold text-amber-300 hover:text-amber-200" />
              </td>
              <td className="px-3 py-3 text-zinc-300">{row.entryDate || '—'}</td>
              <td className="px-3 py-3 font-mono text-zinc-300">{pct(row.thrustPct)}</td>
              <td className="px-3 py-3 font-mono text-zinc-300">{pct(row.retracePct)}</td>
              <td className={`px-3 py-3 font-mono ${returnClass(row.accel20Pct)}`}>{pct(row.accel20Pct)}</td>
              <td className={`px-3 py-3 font-mono ${returnClass(row.roc20Pct)}`}>{pct(row.roc20Pct)}</td>
              <td className="px-3 py-3">
                {row.inTopBook ? (
                  <span className="rounded-full border border-amber-700 bg-amber-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Top 10
                  </span>
                ) : (
                  <span className="text-zinc-600">Pool</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FirstPullbacksClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<FirstPullbackPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/first-pullback', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || payload.message || 'Could not load First Pullbacks.');
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

  const rows = useMemo(() => data?.rows || [], [data?.rows]);
  const book = data?.book || data?.forwardTest?.books?.[0];
  const regime = data?.regime;
  const regimeTrack = data?.regimeTrack;

  return (
    <>
      <ScannerExtrasNav active="/scanner/first-pullbacks" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-amber-300 hover:text-amber-200">
            Go to scanner login
          </a>
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-red-300">{error}</section>
      ) : (
        <div className="space-y-6">
          {!data?.connected ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <p className="text-zinc-300">{data?.message || 'First Pullbacks data is not connected yet.'}</p>
            </section>
          ) : (
            <>
              <FirstPullbackRegimeCard regime={regime} track={regimeTrack} />

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">As of</p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-100">{data.asOf || '—'}</p>
                    <p className="mt-2 text-sm text-zinc-400">
                      Pool {data.poolCount ?? rows.length} · Top {data.topN ?? 10} in the paper book
                    </p>
                  </div>
                </div>
                {data.backtestNote ? <p className="mt-4 text-sm text-zinc-500">{data.backtestNote}</p> : null}
                {data.method?.length ? (
                  <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                    {data.method.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <ForwardPanel book={book} method={data.forwardTest?.method} />

              <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold text-zinc-100">Current pullback pool</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Ranked by acceleration. Amber rows are in the monthly forward top 10.
                </p>
                <div className="mt-4">
                  <PoolTable rows={rows} />
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </>
  );
}
