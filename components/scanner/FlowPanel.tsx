'use client';

import type { FlowTickerPayload } from '@/lib/scanner-flow-data';

import { FlowBarChart, FlowPieChart } from './flow-charts';

function fmt(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function signalClass(signal: string) {
  if (signal.includes('ACCUMULATING')) return 'text-emerald-700';
  if (signal.includes('DISTRIBUTING')) return 'text-red-700';
  return 'text-amber-700';
}

export default function FlowPanel({ data }: { data: FlowTickerPayload }) {
  const inst = data.institutional;
  const vol = data.volume;
  const opt = data.options;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">{data.label}</h2>
            <p className="text-sm text-zinc-600">Institutions, options, and volume flow</p>
          </div>
          <span className={`text-sm font-semibold ${signalClass(data.signal)}`}>{data.signal}</span>
        </div>
      </div>

      <section className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Options today</h3>
            <p className="text-xs text-zinc-500">Market put/call — not institutional 13F. No history stored.</p>
          </div>
          {opt.available ? (
            <span className={`text-sm font-semibold ${signalClass(opt.sentiment === 'CALL HEAVY' ? 'ACCUMULATING' : opt.sentiment === 'PUT HEAVY' ? 'DISTRIBUTING' : 'MIXED')}`}>
              {opt.sentiment}
            </span>
          ) : null}
        </div>

        {!opt.available ? (
          <p className="text-sm text-zinc-600">{opt.reason || 'Options data unavailable.'}</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Volume ratio (P/C)</div>
                <div className="mt-1 font-mono text-lg font-semibold">{opt.volumeRatio?.toFixed(2) ?? '—'}</div>
                <div className="mt-1 text-zinc-600">
                  Put vol {fmt(opt.putVolume)} · Call vol {fmt(opt.callVolume)}
                </div>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-zinc-500">Open interest ratio (P/C)</div>
                <div className="mt-1 font-mono text-lg font-semibold">{opt.oiRatio?.toFixed(2) ?? '—'}</div>
                <div className="mt-1 text-zinc-600">
                  Put OI {fmt(opt.putOI)} · Call OI {fmt(opt.callOI)}
                </div>
              </div>
            </div>
            <FlowPieChart
              long={opt.callVolume || 0}
              short={opt.putVolume || 0}
              longLabel="Calls"
              shortLabel="Puts"
              centerLabel="VOL"
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Institutional 13F</h3>
            <p className="text-xs text-zinc-500">Fund-reported quarterly share changes — lags filings.</p>
          </div>
          {inst.available && inst.signal ? (
            <span className={`text-sm font-semibold ${signalClass(inst.signal)}`}>{inst.signal}</span>
          ) : null}
        </div>

        {!inst.available ? (
          <p className="text-sm text-zinc-600">{inst.reason || 'Institutional data unavailable.'}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-4 text-sm text-zinc-700">
              <span>Latest filing {inst.dateReported}</span>
              <span>{inst.quarterCount} quarter(s) cached</span>
              <span>{inst.holdersCount?.toLocaleString()} holders</span>
              <span>{inst.buyersCount?.toLocaleString()} net buyers</span>
              <span>{inst.sellersCount?.toLocaleString()} net sellers</span>
              {inst.ownershipPct != null ? (
                <span className={inst.ownershipPct >= 90 ? 'font-semibold text-amber-800' : ''}>
                  {inst.ownershipPct.toFixed(1)}% inst. owned
                  {inst.ownershipPct >= 90 ? ' (crowded)' : ''}
                </span>
              ) : null}
            </div>
            <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
              <FlowBarChart
                series={inst.chartQuarters?.length ? inst.chartQuarters : inst.quarters || []}
                longLabel="Institutional buying $"
                shortLabel="Institutional selling $"
                scaleMode="ratio"
              />
              <div>
                <FlowPieChart
                  long={inst.latestQuarterBuying ?? inst.yearBuying ?? 0}
                  short={inst.latestQuarterSelling ?? inst.yearSelling ?? 0}
                  longLabel="Buying"
                  shortLabel="Selling"
                  centerLabel="13F"
                />
                <p className="mt-2 text-center text-[11px] text-zinc-500">
                  Latest filing quarter · bar chart shows up to {inst.quarterCount ?? 1} quarter(s)
                </p>
              </div>
            </div>
            {inst.note ? <p className="mt-3 text-xs text-zinc-500">{inst.note}</p> : null}
          </>
        )}
      </section>

      <section className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Volume profile (~1 month)</h3>
            <p className="text-xs text-zinc-500">Up-day vs down-day volume — last ~21 sessions.</p>
          </div>
          {vol.available && vol.signal ? (
            <span className={`text-sm font-semibold ${signalClass(vol.signal)}`}>{vol.signal}</span>
          ) : null}
        </div>

        {!vol.available ? (
          <p className="text-sm text-zinc-600">{vol.reason || 'Volume data unavailable.'}</p>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-4 text-sm text-zinc-700">
              <span>{vol.sessions} sessions</span>
              <span>Up volume {fmt(vol.totalUpVolume)}</span>
              <span>Down volume {fmt(vol.totalDownVolume)}</span>
            </div>
            <FlowBarChart series={vol.series || []} longLabel="Up-day volume" shortLabel="Down-day volume" />
          </>
        )}
      </section>
    </div>
  );
}
