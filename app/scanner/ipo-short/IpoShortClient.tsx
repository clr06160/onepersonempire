'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  IpoShortHorizon,
  IpoShortPayload,
  IpoShortRule,
} from '@/lib/scanner-ipo-short-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function winPct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function signClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-500';
  if (value > 0) return 'text-emerald-400/90';
  if (value < 0) return 'text-red-400/90';
  return 'text-zinc-300';
}

function ruleBorder(tone?: string) {
  if (tone === 'danger') return 'border-red-800/70 bg-red-950/35';
  if (tone === 'warning') return 'border-amber-800/70 bg-amber-950/30';
  return 'border-sky-800/60 bg-sky-950/25';
}

function ruleTitle(tone?: string) {
  if (tone === 'danger') return 'text-red-300';
  if (tone === 'warning') return 'text-amber-300';
  return 'text-sky-300';
}

function HorizonCard({ title, h }: { title: string; h?: IpoShortHorizon }) {
  if (!h) return null;
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
      <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
      <p className="mt-1 text-xs text-zinc-500">
        {h.trades?.toLocaleString() ?? '—'} trades · {h.label}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Win rate</p>
          <p className="mt-1 font-mono text-xl font-semibold text-zinc-100">{winPct(h.winRatePct)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Avg gain</p>
          <p className={`mt-1 font-mono text-xl font-semibold ${signClass(h.avgPct)}`}>{pct(h.avgPct)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Median gain</p>
          <p className={`mt-1 font-mono text-xl font-semibold ${signClass(h.medianPct)}`}>
            {pct(h.medianPct)}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Avg winner</p>
          <p className={`mt-1 font-mono text-sm ${signClass(h.avgWinPct)}`}>{pct(h.avgWinPct)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Avg loser</p>
          <p className={`mt-1 font-mono text-sm ${signClass(h.avgLossPct)}`}>{pct(h.avgLossPct)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Worst trade</p>
          <p className="mt-1 font-mono text-sm text-red-400/90">{pct(h.worstPct)}</p>
        </div>
      </div>
    </section>
  );
}

function Rules({ rules }: { rules: IpoShortRule[] }) {
  if (!rules.length) return null;
  return (
    <section className="mb-6 grid gap-3">
      {rules.map((rule) => (
        <div key={rule.title} className={`rounded-2xl border p-4 ${ruleBorder(rule.tone)}`}>
          <h3 className={`text-sm font-semibold ${ruleTitle(rule.tone)}`}>{rule.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{rule.body}</p>
        </div>
      ))}
    </section>
  );
}

export default function IpoShortClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<IpoShortPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/ipo-short', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load Shorting IPOs.');
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

  const h3 = data?.headline?.hold3m;
  const h6 = data?.headline?.hold6m;

  return (
    <>
      <ScannerExtrasNav active="/scanner/ipo-short" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          Loading IPO short study…
        </section>
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

          {data?.message && !data?.headline?.hold6m ? (
            <p className="mb-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">
              {data.message}
            </p>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-zinc-400">
                {data?.window?.start && data?.window?.end
                  ? `${data.window.start} → ${data.window.end}`
                  : 'Event study'}
                {data?.universe?.trades6m
                  ? ` · ${data.universe.trades6m.toLocaleString()} completed 6m trades`
                  : ''}
              </p>
              <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
            </div>
            {data?.generatedAt ? (
              <span className="text-xs text-zinc-500">
                Updated {new Date(data.generatedAt).toLocaleString()}
              </span>
            ) : null}
          </div>

          <Rules rules={data?.operatingRules || []} />

          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">6m win rate</p>
              <p className="mt-2 font-mono text-3xl font-bold text-zinc-50">{winPct(h6?.winRatePct)}</p>
              <p className="mt-1 text-xs text-zinc-500">Share of shorts with P&amp;L &gt; 0</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">6m avg gain</p>
              <p className={`mt-2 font-mono text-3xl font-bold ${signClass(h6?.avgPct)}`}>
                {pct(h6?.avgPct)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Mean short return, including blow-ups</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">6m median gain</p>
              <p className={`mt-2 font-mono text-3xl font-bold ${signClass(h6?.medianPct)}`}>
                {pct(h6?.medianPct)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Typical trade (more than the average)</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">6m worst</p>
              <p className="mt-2 font-mono text-3xl font-bold text-red-400/90">{pct(h6?.worstPct)}</p>
              <p className="mt-1 text-xs text-zinc-500">Why position size must stay tiny</p>
            </div>
          </section>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <HorizonCard title="Hold ~3 months" h={h3} />
            <HorizonCard title="Hold ~6 months" h={h6} />
          </div>

          {data?.bottomLine?.length ? (
            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Bottom line</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-300">
                {data.bottomLine.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {data?.stopSweep6m?.length ? (
            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Why stops fail (6-month book)</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Wider stops still give back most of the ~+13% no-stop average until they almost never
                fire.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-zinc-400">
                      <th className="py-2 pr-3">Rule</th>
                      <th className="py-2 pr-3 text-right">Win %</th>
                      <th className="py-2 pr-3 text-right">Avg</th>
                      <th className="py-2 pr-3 text-right">Median</th>
                      <th className="py-2 pr-3 text-right">Worst</th>
                      <th className="py-2 pr-3 text-right">Stops hit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stopSweep6m.map((row) => (
                      <tr key={row.label} className="border-b border-zinc-800/80">
                        <td className="py-2 pr-3">
                          <span className="font-medium text-zinc-100">{row.label}</span>
                          {row.note ? (
                            <span className="mt-0.5 block text-xs text-zinc-500">{row.note}</span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                          {winPct(row.winRatePct)}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(row.avgPct)}`}>
                          {pct(row.avgPct)}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(row.medianPct)}`}>
                          {pct(row.medianPct)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-red-400/90">
                          {pct(row.worstPct)}
                        </td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-400">
                          {row.stops == null ? '—' : row.stops}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {data?.byYear6m?.length ? (
            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">6-month shorts by IPO year</h2>
              <p className="mt-1 text-sm text-zinc-400">
                2020 (melt-up cohort) was the killer year; 2021–2022 carried the book.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-left text-zinc-400">
                      <th className="py-2 pr-3">Year</th>
                      <th className="py-2 pr-3 text-right">Trades</th>
                      <th className="py-2 pr-3 text-right">Win %</th>
                      <th className="py-2 pr-3 text-right">Avg</th>
                      <th className="py-2 pr-3 text-right">Median</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byYear6m.map((row) => (
                      <tr key={row.year} className="border-b border-zinc-800/80">
                        <td className="py-2 pr-3 font-medium text-zinc-100">{row.year}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">{row.count}</td>
                        <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                          {winPct(row.winRatePct)}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(row.avgPct)}`}>
                          {pct(row.avgPct)}
                        </td>
                        <td className={`py-2 pr-3 text-right font-mono ${signClass(row.medianPct)}`}>
                          {pct(row.medianPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {data?.method?.length ? (
            <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h2 className="text-lg font-semibold text-zinc-200">Method</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-400">
                {data.method.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {data.note ? <p className="mt-4 text-xs leading-5 text-zinc-500">{data.note}</p> : null}
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
