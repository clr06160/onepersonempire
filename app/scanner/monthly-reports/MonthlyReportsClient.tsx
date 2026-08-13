'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MonthlyReportMonth, MonthlyReportsPayload } from '@/lib/scanner-monthly-reports';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function day3Class(value?: number | null, threshold = 10) {
  if (value == null || Number.isNaN(value)) return 'text-zinc-500';
  if (value >= threshold) return 'bg-sky-950/80 font-semibold text-sky-200';
  if (value <= -threshold) return 'bg-red-950/70 font-semibold text-red-200';
  if (value > 0) return 'text-emerald-400/90';
  if (value < 0) return 'text-red-400/90';
  return 'text-zinc-300';
}

function badgeClass(badge?: string | null) {
  if (badge === 'pass') return 'border-sky-600/70 bg-sky-950/70 text-sky-200';
  if (badge === 'fail') return 'border-red-700/70 bg-red-950/60 text-red-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-500';
}

function tagClass(tag: string) {
  if (
    tag.includes('down') ||
    tag.includes('miss') ||
    tag.includes('lagging') ||
    tag === 'Opaque' ||
    tag === 'Miss guidance'
  ) {
    return 'border-red-800/60 bg-red-950/40 text-red-200';
  }
  if (tag.includes('up') || tag.includes('beat') || tag === 'Beat guidance') {
    return 'border-sky-800/60 bg-sky-950/40 text-sky-200';
  }
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function PrintTable({
  rows,
  threshold,
  empty,
}: {
  rows: MonthlyReportMonth['winners'];
  threshold: number;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Ticker</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Parent</th>
            <th className="px-3 py-2 font-medium">What happened</th>
            <th className="px-3 py-2 font-medium">Day0</th>
            <th className="px-3 py-2 font-medium">Day+3</th>
            <th className="px-3 py-2 font-medium">Badge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.ticker}-${row.reportDate}`} className="border-t border-zinc-800/80 align-top">
              <td className="px-3 py-2">
                <a
                  href={`/scanner/charts?ticker=${encodeURIComponent(row.ticker)}`}
                  className="font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  {row.ticker}
                </a>
                {row.microsector ? (
                  <p className="mt-0.5 text-[11px] text-zinc-600">{row.microsector}</p>
                ) : null}
              </td>
              <td className="px-3 py-2 font-mono text-zinc-400">{row.reportDate}</td>
              <td className="px-3 py-2 text-zinc-400">{row.parent || '—'}</td>
              <td className="max-w-[18rem] px-3 py-2">
                {(row.causeTags || []).length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.causeTags!.map((tag) => (
                      <span
                        key={tag}
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${tagClass(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {row.plainLine ? (
                  <p className="mt-1 text-xs leading-5 text-zinc-300">{row.plainLine}</p>
                ) : !(row.causeTags || []).length ? (
                  <span className="text-xs text-zinc-600">—</span>
                ) : null}
              </td>
              <td className={`px-3 py-2 font-mono ${day3Class(row.day0Pct, threshold)}`}>
                {pct(row.day0Pct)}
              </td>
              <td className={`px-3 py-2 font-mono ${day3Class(row.day3Pct, threshold)}`}>
                {pct(row.day3Pct)}
              </td>
              <td className="px-3 py-2">
                {row.badge === 'pass' || row.badge === 'fail' ? (
                  <span
                    className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass(row.badge)}`}
                  >
                    {row.badge === 'pass' ? 'PASS+' : 'FAIL−'}
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MonthlyReportsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<MonthlyReportsPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/monthly-reports', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || payload.message || 'Could not load monthly reports.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    const next = (payload.data || null) as MonthlyReportsPayload | null;
    setData(next);
    setSelectedMonth((prev) => prev || next?.defaultMonth || next?.months?.[0]?.month || '');
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const month = useMemo(() => {
    return data?.months?.find((row) => row.month === selectedMonth) || data?.months?.[0] || null;
  }, [data, selectedMonth]);

  const threshold = data?.thresholdPct ?? 10;

  return (
    <>
      <ScannerExtrasNav active="/scanner/monthly-reports" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading report…</section>
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

          {data?.message && !data.months?.length ? (
            <section className="rounded-2xl border border-sky-800/40 bg-sky-950/20 p-8 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-400">
                Coming soon
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-zinc-50">Monthly Leaders reaction report</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                {data.message ||
                  'Waiting on settled day+3 prints for the Leaders roster. After the next earnings cluster prints and badges refresh, months will fill in here.'}
              </p>
            </section>
          ) : null}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
                  Month
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(data?.months || []).map((row) => {
                    const active = row.month === (month?.month || selectedMonth);
                    return (
                      <button
                        key={row.month}
                        type="button"
                        onClick={() => setSelectedMonth(row.month)}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                          active
                            ? 'border-sky-500 bg-sky-950 text-sky-100'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                        }`}
                      >
                        {row.label}
                        <span className="ml-2 font-mono text-xs text-zinc-500">{row.printCount}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-sm text-zinc-500">
                {data?.leadersTickerCount ?? 0} Leaders names · day+3 signal · as of{' '}
                <span className="font-mono text-zinc-300">{data?.asOf || '—'}</span>
              </p>
            </div>
          </section>

          {month ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Prints</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-zinc-50">{month.printCount}</p>
                </div>
                <div className="rounded-2xl border border-sky-900/50 bg-sky-950/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-sky-400">PASS+ (≥+{threshold}%)</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-sky-200">
                    {month.passCount}
                    <span className="ml-2 text-base font-normal text-zinc-400">
                      {month.passRatePct != null ? `${month.passRatePct}%` : ''}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4">
                  <p className="text-xs uppercase tracking-wide text-red-400">FAIL− (≤−{threshold}%)</p>
                  <p className="mt-2 font-mono text-3xl font-semibold text-red-200">
                    {month.failCount}
                    <span className="ml-2 text-base font-normal text-zinc-400">
                      {month.failRatePct != null ? `${month.failRatePct}%` : ''}
                    </span>
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Median day+3</p>
                  <p className={`mt-2 font-mono text-3xl font-semibold ${day3Class(month.medianDay3Pct, threshold)}`}>
                    {pct(month.medianDay3Pct)}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-sky-800/40 bg-sky-950/20 p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-400">
                  Facts · {month.label}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-200">
                  {month.conclusions.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {month.topTags?.length ? (
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-sky-900/50 pt-4">
                    {month.topTags.map((row) => (
                      <span
                        key={row.tag}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] ${tagClass(row.tag)}`}
                      >
                        {row.tag}
                        <span className="font-mono text-zinc-500">{row.count}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {data?.studyBlurb ? (
                  <p className="mt-4 border-t border-sky-900/50 pt-4 text-xs leading-5 text-zinc-500">
                    {data.studyBlurb}
                  </p>
                ) : null}
              </section>

              {data?.ledgerByMonth?.[month.month] ? (
                <section className="rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400">
                        Forward-test ledger · how to improve · {month.label}
                      </p>
                      <p className="mt-2 text-sm text-zinc-400">
                        Proprietary paper-trade DB across scanner forward tests.
                        {data.ledgerByMonth[month.month].closedCount
                          ? ` ${data.ledgerByMonth[month.month].closedCount} closed this month · avg ${
                              data.ledgerByMonth[month.month].avgReturnPct != null
                                ? `${data.ledgerByMonth[month.month].avgReturnPct! >= 0 ? '+' : ''}${data.ledgerByMonth[month.month].avgReturnPct!.toFixed(1)}%`
                                : '—'
                            } · hit ${data.ledgerByMonth[month.month].hitRatePct ?? '—'}%.`
                          : ' No closed ledger trades tagged to this month yet — sync on the Ledger page.'}
                      </p>
                    </div>
                    <a
                      href="/scanner/ledger"
                      className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-sm text-emerald-200 hover:border-emerald-500"
                    >
                      Open ledger
                    </a>
                  </div>
                  <div className="mt-4 space-y-3">
                    {data.ledgerByMonth[month.month].recommendations.map((rec) => (
                      <article
                        key={rec.id}
                        className={`rounded-xl border p-4 ${
                          rec.severity === 'high'
                            ? 'border-red-700/60 bg-red-950/30'
                            : rec.severity === 'medium'
                              ? 'border-amber-700/50 bg-amber-950/25'
                              : rec.severity === 'low'
                                ? 'border-emerald-700/50 bg-emerald-950/25'
                                : 'border-zinc-700 bg-zinc-950/40'
                        }`}
                      >
                        <h3 className="text-base font-semibold text-zinc-50">{rec.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-zinc-300">{rec.detail}</p>
                        <p className="mt-2 text-sm font-medium text-emerald-200">→ {rec.action}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-sky-900/40 bg-zinc-900/80 p-5">
                  <h2 className="text-lg font-semibold text-sky-200">PASS+ (day+3 ≥ +{threshold}%)</h2>
                  <p className="mt-1 text-sm text-zinc-500">Settled reaction. Read the facts column, not the press release.</p>
                  <div className="mt-4">
                    <PrintTable
                      rows={month.winners}
                      threshold={threshold}
                      empty="No ≥+10% day+3 prints this month."
                    />
                  </div>
                </section>
                <section className="rounded-2xl border border-red-900/40 bg-zinc-900/80 p-5">
                  <h2 className="text-lg font-semibold text-red-200">FAIL− (day+3 ≤ −{threshold}%)</h2>
                  <p className="mt-1 text-sm text-zinc-500">Settled reaction. Same rule: numbers over narrative.</p>
                  <div className="mt-4">
                    <PrintTable
                      rows={month.losers}
                      threshold={threshold}
                      empty="No ≤−10% day+3 prints this month."
                    />
                  </div>
                </section>
              </div>

              {month.byParent.length ? (
                <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
                  <div className="border-b border-zinc-800 px-5 py-4">
                    <h2 className="text-lg font-semibold text-zinc-100">Parent trends</h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      Median day+3 by Leaders parent for this month (min helpful when n is thin).
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Parent</th>
                          <th className="px-4 py-3 font-medium">Prints</th>
                          <th className="px-4 py-3 font-medium">PASS+</th>
                          <th className="px-4 py-3 font-medium">FAIL−</th>
                          <th className="px-4 py-3 font-medium">Med day+3</th>
                        </tr>
                      </thead>
                      <tbody>
                        {month.byParent.map((row) => (
                          <tr key={row.parent} className="border-t border-zinc-800/80">
                            <td className="px-4 py-3 font-semibold text-zinc-100">{row.parent}</td>
                            <td className="px-4 py-3 font-mono text-zinc-400">{row.printCount}</td>
                            <td className="px-4 py-3 font-mono text-sky-300">{row.passCount}</td>
                            <td className="px-4 py-3 font-mono text-red-300">{row.failCount}</td>
                            <td className={`px-4 py-3 font-mono ${day3Class(row.medianDay3Pct, threshold)}`}>
                              {pct(row.medianDay3Pct)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
                <div className="border-b border-zinc-800 px-5 py-4">
                  <h2 className="text-lg font-semibold text-zinc-100">All Leaders prints · {month.label}</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Sorted by day+3. Blue / red at ±{threshold}%. Day0 shown for context only.
                  </p>
                </div>
                <div className="p-4">
                  <PrintTable
                    rows={month.allPrints}
                    threshold={threshold}
                    empty="No prints this month."
                  />
                </div>
              </section>
            </>
          ) : null}

          {data?.method?.length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-500">
              <p className="font-semibold text-zinc-400">Method</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.method.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-3">
                Upcoming prints stay on{' '}
                <a href="/scanner/calendar" className="text-sky-400 hover:text-sky-300">
                  Earnings calendar
                </a>
                . Live roster on{' '}
                <a href="/scanner/leaders" className="text-sky-400 hover:text-sky-300">
                  Leaders
                </a>
                .
              </p>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
