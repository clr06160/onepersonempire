'use client';

import { useCallback, useEffect, useState } from 'react';

import type { RawBearForwardTest, RawBearPayload, RawBearUniverse } from '@/lib/scanner-raw-bear-data';

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
  if (n >= 3) return 'text-emerald-300';
  if (n <= -3) return 'text-red-300';
  return 'text-zinc-200';
}

function ForwardPanel({ forwardTest }: { forwardTest?: RawBearForwardTest }) {
  if (!forwardTest?.universes?.length) return null;
  const rows = forwardTest.universes.filter((u) => u.key !== 'overall');
  const overall = forwardTest.universes.find((u) => u.key === 'overall');

  return (
    <section className="rounded-2xl border border-red-900/40 bg-zinc-950/70 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-red-400">Forward test</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">How the bear book is doing</h2>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">{forwardTest.method}</p>
      {overall?.summary ? (
        <p className="mt-3 text-sm text-zinc-300">
          <span className="text-red-300">Overall</span> forward total:{' '}
          <span className={`font-mono ${classForScore(overall.summary.totalReturnPct)}`}>
            {pct(overall.summary.totalReturnPct)}
          </span>
          {' · '}
          {overall.summary.periodCount ?? 0} periods · hit rate {pct(overall.summary.hitRatePct)}
        </p>
      ) : (
        <p className="mt-3 text-sm text-zinc-500">First rebuild seeds portfolios — period returns start on the next refresh.</p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="py-2 pr-3">Universe</th>
              <th className="py-2 pr-3 text-right">Open</th>
              <th className="py-2 pr-3 text-right">Live avg</th>
              <th className="py-2 pr-3 text-right">Fwd total</th>
              <th className="py-2 pr-3 text-right">Periods</th>
              <th className="py-2 pr-3">Holdings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-zinc-800/80">
                <td className="py-2 pr-3 font-semibold text-zinc-100">{row.label}</td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-300">{row.openCount ?? 0}</td>
                <td className={`py-2 pr-3 text-right font-mono ${classForScore(row.openAvgReturnPct)}`}>
                  {pct(row.openAvgReturnPct)}
                </td>
                <td className={`py-2 pr-3 text-right font-mono ${classForScore(row.summary?.totalReturnPct)}`}>
                  {pct(row.summary?.totalReturnPct)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-500">{row.summary?.periodCount ?? 0}</td>
                <td className="py-2 pr-3 text-xs text-zinc-400">
                  {row.currentTickers?.length ? row.currentTickers.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UniverseCard({ group }: { group: RawBearUniverse }) {
  const rows = group.rows ?? [];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-red-200">{group.label}</h2>
        <p className="text-xs text-zinc-500">
          {group.negativeCount ?? rows.length} / {group.eligibleCount ?? '—'} eligible · bottom {rows.length || 10} negative
        </p>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-700 text-left text-zinc-400">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Ticker</th>
                <th className="py-2 pr-3 text-right">Accel score</th>
                <th className="py-2 pr-3 text-right">21d ROC</th>
                <th className="py-2 pr-3 text-right">20d accel</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ticker} className="border-b border-zinc-800/80">
                  <td className="py-2 pr-3 font-mono text-zinc-500">{row.rank}</td>
                  <td className="py-2 pr-3">
                    <TickerLink ticker={row.ticker} className="font-semibold text-zinc-100 hover:text-red-300" />
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-red-300/90">{row.accelScore?.toFixed(2) ?? '—'}</td>
                  <td className="py-2 pr-3 text-right font-mono text-red-200">{pct(row.roc20Pct)}</td>
                  <td className="py-2 pr-3 text-right font-mono text-red-200">{pct(row.accel20Pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No names with both 21d and 63d momentum negative today.</p>
      )}
    </section>
  );
}

export default function RawBearClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<RawBearPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/scanner/raw-bear', fetchInit);
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

  return (
    <>
      <ScannerExtrasNav active="/scanner/raw-bear" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Scanning for negative momentum…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first.</p>
          <a href="/scanner" className="mt-4 inline-flex text-cyan-300 hover:text-cyan-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-6">
            <h2 className="text-lg font-semibold text-zinc-100">How this works</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-zinc-400">
              <li>Same accel engine as Daily Raw — filter flipped to negative momentum only.</li>
              <li>Names here have <strong className="font-normal text-red-300">negative 21d + 63d momentum</strong> — falling fastest in that universe (e.g. CRWD/KLAC if semis/software are weak).</li>
            "Forward test: equal-weight each sleeve between rebuilds — returns simulated as <strong className="font-normal text-red-300">short</strong> (you profit when these names fall). Not real short positions.",
              <li>IRA: use as context for cash, TZA, SQQQ, SOXS — not literal stock shorts.</li>
            </ul>
          </section>

          <ForwardPanel forwardTest={data?.forwardTest} />

          {error ? <p className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-200">{error}</p> : null}
          {data?.message && !data?.universes?.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-1">
            {(data?.universes ?? []).map((group) => (
              <UniverseCard key={group.key || group.label} group={group} />
            ))}
          </div>

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
