'use client';

import Link from 'next/link';

import type {
  FirstPullbackRegime,
  FirstPullbackRegimeTrack,
} from '@/lib/scanner-first-pullback-data';

export type RegimeTrackSummary = FirstPullbackRegimeTrack;

type Props = {
  regime?: FirstPullbackRegime | null;
  track?: RegimeTrackSummary | null;
  /** Extra footer link back to the full First Pullbacks page */
  showPageLink?: boolean;
  compact?: boolean;
};

function pct(n?: number | null, digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function edgeClass(n?: number | null) {
  if (n == null || Number.isNaN(n)) return 'text-zinc-400';
  if (n > 0) return 'text-emerald-300';
  if (n < 0) return 'text-red-300';
  return 'text-zinc-300';
}

export default function FirstPullbackRegimeCard({
  regime,
  track,
  showPageLink = false,
  compact = false,
}: Props) {
  if (!regime) {
    return (
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm text-zinc-400">Data is refreshing. Check back shortly.</p>
      </section>
    );
  }

  const fit = String(regime.fit || 'mixed').toLowerCase();
  const styles =
    fit === 'favorable'
      ? {
          border: 'border-emerald-700/60',
          bg: 'bg-emerald-950/30',
          mark: 'text-emerald-300',
          markText: '✓',
          label: regime.fitLabel || 'Favorable',
        }
      : fit === 'unfavorable'
        ? {
            border: 'border-red-800/60',
            bg: 'bg-red-950/25',
            mark: 'text-red-300',
            markText: '×',
            label: regime.fitLabel || 'Unfavorable',
          }
        : {
            border: 'border-amber-700/60',
            bg: 'bg-amber-950/25',
            mark: 'text-amber-300',
            markText: '~',
            label: regime.fitLabel || 'Mixed',
          };

  return (
    <section className={`rounded-2xl border ${styles.border} ${styles.bg} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
          First Pullbacks · style fit
        </p>
        {showPageLink ? (
          <Link href="/scanner/first-pullbacks" className="text-xs font-semibold text-amber-300 hover:text-amber-200">
            Open page →
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${styles.border} text-2xl font-black ${styles.mark}`}
          aria-label={styles.label}
        >
          {styles.markText}
        </div>
        <div>
          <p className={`text-xl font-bold sm:text-2xl ${styles.mark}`}>{styles.label}</p>
          <p className="mt-1 max-w-xl text-sm text-zinc-300">
            {regime.headline || regime.hint || 'Tape score for first-pullback vs chasey accel.'}
          </p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">QQQ vs 200-day</p>
            <p className="mt-1 font-semibold text-zinc-100">
              {regime.aboveMa200 ? 'Above' : 'Below'}
              {regime.qqqClose != null && regime.qqqMa200 != null ? (
                <span className="ml-2 font-normal text-zinc-400">
                  {regime.qqqClose.toFixed(0)} vs MA {regime.qqqMa200.toFixed(0)}
                </span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">20d volatility</p>
            <p className="mt-1 font-semibold capitalize text-zinc-100">
              {regime.volBucket || '—'}
              {regime.vol20AnnPct != null ? (
                <span className="ml-2 font-normal text-zinc-400">~{regime.vol20AnnPct.toFixed(0)}% ann.</span>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      {regime.reasons?.length && !compact ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-400">
          {regime.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {track && (track.totalDays ?? 0) > 0 ? (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Live track · does the light still work?
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {track.note ||
              'Daily edge = FP paper book return minus plain-accel top-10 return, grouped by that day’s light.'}
            {track.totalDays != null ? ` · ${track.totalDays} days tracked` : null}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-700 text-left text-zinc-500">
                  <th className="py-2 pr-3">When light was…</th>
                  <th className="py-2 pr-3 text-right">Days</th>
                  <th className="py-2 pr-3 text-right">Avg FP−accel</th>
                </tr>
              </thead>
              <tbody>
                {(track.byFit || []).map((row) => (
                  <tr key={row.fit} className="border-b border-zinc-800/80">
                    <td className="py-2 pr-3 capitalize text-zinc-200">{row.fit}</td>
                    <td className="py-2 pr-3 text-right font-mono text-zinc-400">{row.days ?? 0}</td>
                    <td className={`py-2 pr-3 text-right font-mono ${edgeClass(row.avgEdgeFpMinusAccelPct)}`}>
                      {pct(row.avgEdgeFpMinusAccelPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(track.totalDays ?? 0) < 20 ? (
            <p className="mt-2 text-xs text-amber-200/80">
              Need ~20+ trading days before this track means much — early numbers will jump around.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">
          Forward track starts as you rebuild daily: we’ll compare FP vs plain-accel returns under each light color
          to see if the guide still works or dies.
        </p>
      )}
    </section>
  );
}
