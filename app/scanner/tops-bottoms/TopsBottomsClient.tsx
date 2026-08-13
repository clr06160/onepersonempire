'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TopsBottomsEvent, TopsBottomsPayload } from '@/lib/scanner-tops-bottoms-data';
import type { ResearchStatRow } from '@/lib/scanner-tops-research';
import { TOPS_BOTTOMS_RESEARCH } from '@/lib/scanner-tops-research';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const PATTERN_LABELS: Record<string, string> = {
  double_top: 'Possible top',
  triple_top: 'Possible top (triple)',
  double_bottom: 'Possible bottom',
  triple_bottom: 'Possible bottom (triple)',
};

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function patternClass(pattern?: string) {
  if (pattern?.includes('top')) return 'border-red-800/60 bg-red-950/40 text-red-200';
  if (pattern?.includes('bottom')) return 'border-sky-800/60 bg-sky-950/40 text-sky-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function plainMeaning(row: TopsBottomsEvent): string {
  const gave = row.gaveUpPct;
  const lag = row.barsFromLastPivot;
  const parts: string[] = [];
  if (row.pattern?.includes('top')) {
    parts.push('Price made two highs, then broke down.');
    if (gave != null) parts.push(`Already ${gave}% below those highs when it confirmed.`);
  } else {
    parts.push('Price made two lows, then broke up.');
    if (gave != null) parts.push(`Already ${gave}% above those lows when it confirmed.`);
  }
  if (lag != null) parts.push(`${lag} trading days after the last swing.`);
  if (row.hit10) parts.push('After that, it moved another ~10% the right way within 3 months.');
  else if (row.hit10 === false) parts.push('After that, it did not follow through by ~10% within 3 months.');
  return parts.join(' ');
}

function StatTable({ rows, hitSuffix = 'hit' }: { rows: ResearchStatRow[]; hitSuffix?: string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-950/70 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Rule</th>
            <th className="px-3 py-2 font-medium">{hitSuffix}</th>
            <th className="px-3 py-2 font-medium">n</th>
            <th className="px-3 py-2 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-zinc-800/80 align-top">
              <td className="px-3 py-2 text-zinc-200">{row.label}</td>
              <td className="px-3 py-2 font-mono text-sky-200">
                {row.hitPct != null ? `${row.hitPct}%` : '—'}
              </td>
              <td className="px-3 py-2 font-mono text-zinc-500">{row.n ?? '—'}</td>
              <td className="px-3 py-2 text-xs leading-5 text-zinc-500">{row.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Pick illustrative desk doubles: prefer recent, balance tops/bottoms and hit/miss. */
function pickExampleSignals(events: TopsBottomsEvent[]): TopsBottomsEvent[] {
  const pool = (events || [])
    .filter((e) => e.deskPass && e.universe === 'holdout')
    .filter((e) => e.pattern === 'double_top' || e.pattern === 'double_bottom')
    .slice()
    .sort((a, b) => String(b.confirmDate || '').localeCompare(String(a.confirmDate || '')));

  const take = (pred: (e: TopsBottomsEvent) => boolean, n: number) => {
    const out: TopsBottomsEvent[] = [];
    for (const e of pool) {
      if (pred(e)) out.push(e);
      if (out.length >= n) break;
    }
    return out;
  };

  const picked = [
    ...take((e) => e.pattern === 'double_bottom' && e.hit10 === true, 3),
    ...take((e) => e.pattern === 'double_bottom' && e.hit10 === false, 2),
    ...take((e) => e.pattern === 'double_top' && e.hit10 === true, 2),
    ...take((e) => e.pattern === 'double_top' && e.hit10 === false, 2),
  ];

  // de-dupe
  const seen = new Set<string>();
  const unique: TopsBottomsEvent[] = [];
  for (const e of picked) {
    const key = `${e.ticker}-${e.confirmDate}-${e.pattern}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }
  return unique.slice(0, 10);
}

export default function TopsBottomsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<TopsBottomsPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/tops-bottoms', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || payload.message || 'Could not load tops & bottoms.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData((payload.data || null) as TopsBottomsPayload | null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const research = data?.research || TOPS_BOTTOMS_RESEARCH;
  const desk = data?.holdoutStats?.closeness?.deskFilter;
  const examples = useMemo(() => pickExampleSignals(data?.events || []), [data?.events]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/tops-bottoms" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading…</section>
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

          <p className="text-xs leading-5 text-zinc-500">{research.holdoutNote}</p>

          {/* Wave 4 */}
          <section className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-400">
              Primary process
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">{research.wave4Exit.title}</h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{research.wave4Exit.summary}</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-zinc-300">
              {research.wave4Exit.process.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-amber-300/90">
              Holdout odds after extension + MA break
            </p>
            <div className="mt-2">
              <StatTable rows={research.wave4Exit.maBreakRows} hitSuffix="rate" />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{research.wave4Exit.leftoversNote}</p>
            <p className="mt-3 text-xs text-zinc-500">
              Live badges for current leaders:{' '}
              <a href="/scanner/leaders" className="text-amber-300 hover:text-amber-200">
                Leaders → Wave 4 strip
              </a>
            </p>
          </section>

          {/* Sector priors */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Wave-3 length priors (avg move)
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Expected wave-3 size by group — near this length, tighten the 10/21 trail.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800/80">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-950/70 text-[11px] uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Group</th>
                    <th className="px-3 py-2 font-medium">Avg move</th>
                    <th className="px-3 py-2 font-medium">Median</th>
                    <th className="px-3 py-2 font-medium">Avg × W1</th>
                    <th className="px-3 py-2 font-medium">Avg days</th>
                  </tr>
                </thead>
                <tbody>
                  {research.priors
                    .filter((p) => p.key !== 'default')
                    .map((p) => (
                      <tr key={p.key} className="border-t border-zinc-800/80">
                        <td className="px-3 py-2 text-zinc-200">
                          {p.label}
                          {p.note ? (
                            <span className="mt-0.5 block text-[11px] text-zinc-500">{p.note}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 font-mono text-amber-200">+{p.avgMovePct}%</td>
                        <td className="px-3 py-2 font-mono text-zinc-300">+{p.medianMovePct}%</td>
                        <td className="px-3 py-2 font-mono text-zinc-400">{p.avgMult}×</td>
                        <td className="px-3 py-2 font-mono text-zinc-400">{p.avgDays}d</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Extensions */}
          <section className="rounded-2xl border border-orange-900/40 bg-orange-950/15 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-400">
              Extensions
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-50">{research.extensions.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{research.extensions.summary}</p>
            <div className="mt-4">
              <StatTable rows={research.extensions.rows} hitSuffix="−10% in 63d" />
            </div>
            <p className="mt-3 text-sm text-zinc-400">
              Thumb: yellow ~+30%, red +40%+ — danger zone, not an exact top call.
            </p>
          </section>

          {/* Tight bottoms */}
          <section className="rounded-2xl border border-sky-800/40 bg-sky-950/20 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-400">
              Bottoms — symmetry probability
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-50">{research.tightBottoms.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{research.tightBottoms.summary}</p>
            <div className="mt-4">
              <StatTable rows={research.tightBottoms.rows} hitSuffix="+10% in 63d" />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{research.tightBottoms.nuance}</p>
          </section>

          {/* EW + weak */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-lg font-semibold text-zinc-50">{research.elliott.title}</h2>
              <div className="mt-3">
                <StatTable rows={research.elliott.rows} hitSuffix="hit ~10%" />
              </div>
              <p className="mt-3 text-sm text-zinc-400">{research.elliott.note}</p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="text-lg font-semibold text-zinc-50">Weak alone (don’t use as the engine)</h2>
              <div className="mt-3">
                <StatTable rows={research.weakTimers} hitSuffix="~hit" />
              </div>
            </div>
          </section>

          {/* Cohort */}
          <section className="rounded-2xl border border-violet-900/40 bg-violet-950/15 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">
              Cohort / breadth
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-50">{research.cohort.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{research.cohort.summary}</p>
            <div className="mt-4">
              <StatTable rows={research.cohort.rows} hitSuffix="rate" />
            </div>
          </section>

          {/* Desk doubles summary */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Secondary — desk double tops/bottoms
            </p>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Older study: doubles only + tiredness tags, skip if already &gt;12% from the swing. Modest edge
              (~{desk?.hit10Pct ?? 56}% follow-through), usually late (median already{' '}
              {desk?.medianGaveUpPct != null ? `${desk.medianGaveUpPct}%` : '~10%+'} from the turn). Not
              the primary exit process.
            </p>
          </section>

          {(data?.caseStudies || []).length ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-50">Case studies</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Charts you flagged — not part of the holdout score.
                </p>
              </div>
              {(data?.caseStudies || []).map((cs) => (
                <article
                  key={cs.ticker}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <a
                      href={cs.chartHref || `/scanner/charts?ticker=${encodeURIComponent(cs.ticker)}`}
                      className="text-lg font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      {cs.ticker}
                    </a>
                    <span className="text-sm text-zinc-400">{cs.title}</span>
                    {cs.nowEwLabel ? (
                      <span className="font-mono text-xs text-zinc-500">now {cs.nowEwLabel}</span>
                    ) : null}
                  </div>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-300">
                    {(cs.notes || []).map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </section>
          ) : null}

          <section>
            <h2 className="text-lg font-semibold text-zinc-50">Example signals (desk doubles only)</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{research.exampleSignalsNote}</p>
            <p className="mt-2 text-xs text-zinc-600">
              Selection: holdout · deskPass · double_top/bottom · prefer recent · aim for a mix of
              bottoms/tops and follow-through vs miss (not “best looking” cherry-picks).
            </p>
            <div className="mt-4 space-y-3">
              {examples.length ? (
                examples.map((row) => (
                  <article
                    key={`${row.ticker}-${row.confirmDate}-${row.pattern}`}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={
                          row.chartHref || `/scanner/charts?ticker=${encodeURIComponent(row.ticker)}`
                        }
                        className="text-lg font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {row.ticker}
                      </a>
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${patternClass(row.pattern)}`}
                      >
                        {PATTERN_LABELS[row.pattern || ''] || row.pattern}
                      </span>
                      <span className="font-mono text-xs text-zinc-500">{row.confirmDate}</span>
                      {row.hit10 ? (
                        <span className="text-xs text-sky-400">followed through</span>
                      ) : (
                        <span className="text-xs text-zinc-500">no follow-through</span>
                      )}
                      {row.gaveUpPct != null ? (
                        <span className="font-mono text-xs text-zinc-600">
                          gave {pct(row.gaveUpPct, 0)}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">{plainMeaning(row)}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-zinc-500">No example events loaded yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              {showMore ? 'Hide build notes' : 'Show build notes'}
            </button>
            {showMore ? (
              <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-400">
                <p>
                  Dev set: {data?.devUniverse?.tickerCount ?? 30} past leaders. Holdout:{' '}
                  {data?.holdoutUniverse?.tickerCount ?? 50} random (seed{' '}
                  {data?.holdoutUniverse?.randomSeed ?? 42}).
                </p>
                <p>
                  Desk double rule: doubles only; tops need 2+ tiredness tags; bottoms need 1+; skip if
                  already more than ~12% from the swing high/low. n={desk?.count ?? '—'}.
                </p>
                {(data?.verdict?.keeps || []).slice(0, 4).map((line) => (
                  <p key={line}>• {line}</p>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
