'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type {
  CotChartMarket,
  CotChartPoint,
  CotForwardSleeve,
  CotForwardTest,
  CotReportPayload,
  CotSide,
} from '@/lib/scanner-cot-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function fmt(n: number) {
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n.toFixed(1)}% OI`;
}

function pct(n?: number | null) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function classForScore(n?: number | null) {
  if (n == null || Number.isNaN(n)) return 'text-zinc-400';
  if (n > 0) return 'text-emerald-300';
  if (n < 0) return 'text-red-300';
  return 'text-zinc-200';
}

function compactNum(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function pieSlice(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.99) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`;
  }
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} Z`;
}

function stanceClass(stance?: string) {
  return stance === 'LONG' ? 'text-emerald-300' : 'text-red-300';
}

function trajectoryClass(trajectory?: string) {
  if (trajectory === 'improving') return 'text-emerald-300';
  if (trajectory === 'worsening') return 'text-red-300';
  return 'text-zinc-400';
}

function sideClass(side?: CotSide | string) {
  if (side === 'LONG') return 'text-emerald-300';
  if (side === 'SHORT') return 'text-red-300';
  return 'text-zinc-500';
}

function CotBarChart({ series }: { series: CotChartPoint[] }) {
  const plot = useMemo(() => {
    if (series.length < 1) return null;

    const w = 440;
    const h = 170;
    const pad = { t: 12, r: 10, b: 30, l: 46 };
    const innerW = w - pad.l - pad.r;
    const innerH = h - pad.t - pad.b;

    const maxVal = Math.max(...series.flatMap((p) => [p.long, p.short]), 1);
    const groupW = innerW / series.length;
    const barW = Math.max(2, Math.min(10, groupW * 0.32));
    const gap = Math.max(1, barW * 0.25);

    const bars = series.flatMap((point, i) => {
      const cx = pad.l + i * groupW + groupW / 2;
      const longH = (point.long / maxVal) * innerH;
      const shortH = (point.short / maxVal) * innerH;
      const baseY = pad.t + innerH;
      return [
        {
          key: `${point.date}-long`,
          x: cx - barW - gap / 2,
          y: baseY - longH,
          w: barW,
          h: longH,
          fill: '#34d399',
        },
        {
          key: `${point.date}-short`,
          x: cx + gap / 2,
          y: baseY - shortH,
          w: barW,
          h: shortH,
          fill: '#f87171',
        },
      ];
    });

    const yTicks = [0, maxVal / 2, maxVal].map((v) => ({
      label: compactNum(v),
      y: pad.t + innerH - (v / maxVal) * innerH,
    }));

    const labelIdx = [0, Math.floor(series.length / 2), series.length - 1];
    const xLabels = labelIdx.map((i) => ({
      x: pad.l + i * groupW + groupW / 2,
      label: series[i]?.date?.slice(5) ?? '',
    }));

    return { w, h, pad, innerH, bars, yTicks, xLabels, first: series[0]?.date ?? '', last: series[series.length - 1]?.date ?? '' };
  }, [series]);

  if (!plot) return null;

  return (
    <svg viewBox={`0 0 ${plot.w} ${plot.h}`} className="w-full" role="img" aria-label="Weekly long and short contracts">
      {plot.yTicks.map((tick) => (
        <g key={tick.label}>
          <line x1={plot.pad.l} x2={plot.w - plot.pad.r} y1={tick.y} y2={tick.y} stroke="#27272a" strokeWidth="1" />
          <text x={plot.pad.l - 6} y={tick.y + 4} textAnchor="end" fill="#71717a" fontSize="10">
            {tick.label}
          </text>
        </g>
      ))}
      <line x1={plot.pad.l} x2={plot.w - plot.pad.r} y1={plot.pad.t + plot.innerH} y2={plot.pad.t + plot.innerH} stroke="#52525b" strokeWidth="1" />
      {plot.bars.map((bar) => (
        <rect key={bar.key} x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 0.5)} rx="1" fill={bar.fill} opacity={0.92} />
      ))}
      {plot.xLabels.map((lbl) => (
        <text key={lbl.label + lbl.x} x={lbl.x} y={plot.h - 10} textAnchor="middle" fill="#71717a" fontSize="9">
          {lbl.label}
        </text>
      ))}
    </svg>
  );
}

function CotPieChart({ long, short }: { long: number; short: number }) {
  const pie = useMemo(() => {
    const total = long + short;
    if (total <= 0) return null;
    const longPct = (long / total) * 100;
    const shortPct = 100 - longPct;
    const cx = 70;
    const cy = 70;
    const r = 58;
    const longEnd = (long / total) * 360;
    return {
      cx,
      cy,
      r,
      longPct,
      shortPct,
      longPath: pieSlice(cx, cy, r, 0, longEnd),
      shortPath: pieSlice(cx, cy, r, longEnd, 360),
    };
  }, [long, short]);

  if (!pie) return null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 140" className="h-36 w-36" role="img" aria-label="Current long versus short split">
        <path d={pie.longPath} fill="#34d399" />
        <path d={pie.shortPath} fill="#f87171" />
        <circle cx={pie.cx} cy={pie.cy} r={26} fill="#09090b" />
        <text x={pie.cx} y={pie.cy - 2} textAnchor="middle" fill="#e4e4e7" fontSize="11" fontWeight="600">
          {pie.longPct >= pie.shortPct ? 'LONG' : 'SHORT'}
        </text>
        <text x={pie.cx} y={pie.cy + 12} textAnchor="middle" fill="#71717a" fontSize="9">
          bias
        </text>
      </svg>
      <div className="mt-2 space-y-1 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          Long {pie.longPct.toFixed(0)}%
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          Short {pie.shortPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

function InstructionsLegend() {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">How to read</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">Stance vs trajectory</h2>
      <div className="mt-4 grid gap-5 md:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">How to read a market</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
            <li>
              <span className="text-zinc-200">Stance</span> = net long or short <em>right now</em> (specs&apos; net
              contracts).
            </li>
            <li>
              <span className="text-zinc-200">Trajectory</span> = did that net get <em>more bullish</em> or{' '}
              <em>more bearish</em> this week? (improving / worsening / unchanged)
            </li>
            <li>
              <span className="text-zinc-200">Extreme</span> = |net % of open interest| ≥ 15 — crowded. Pie % (e.g. 93%
              short) is the long/short <em>split</em>, not the same as net % OI.
            </li>
            <li>Still SHORT + improving = covering / squeeze watch. Still SHORT + worsening = adding fuel to the short.</li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Paper sleeves (under test)</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
            <li>
              <span className="text-zinc-200">Follow</span> — always side with stance.
            </li>
            <li>
              <span className="text-zinc-200">FadeExtreme</span> — only at extremes, bet against stance.
            </li>
            <li>
              <span className="text-zinc-200">Adaptive</span> — fade extremes; otherwise ride only when trajectory
              agrees with stance; else flat.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Scoreboard</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
            <li>Weekly = each COT week&apos;s paper P&amp;L.</li>
            <li>Monthly = compounded weeks in that calendar month.</li>
            <li>Educational only — which sleeve is ahead is the experiment.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function SleeveCard({ sleeve }: { sleeve: CotForwardSleeve }) {
  const weekly = sleeve.weeklySummary || sleeve.summary;
  const monthly = sleeve.monthlySummary;
  const recentMonths = (sleeve.monthly || []).slice(0, 4);

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-lg font-semibold text-zinc-100">{sleeve.label}</h3>
      <p className="mt-2 text-sm text-zinc-300">
        Weekly total{' '}
        <span className={`font-mono ${classForScore(weekly?.totalReturnPct)}`}>{pct(weekly?.totalReturnPct)}</span>
        {' · '}
        {weekly?.periodCount ?? 0} weeks · hit {pct(weekly?.hitRatePct)}
      </p>
      <p className="mt-1 text-sm text-zinc-400">
        Monthly compound{' '}
        <span className={`font-mono ${classForScore(monthly?.totalReturnPct)}`}>{pct(monthly?.totalReturnPct)}</span>
        {' · '}
        {monthly?.periodCount ?? 0} months
      </p>
      {sleeve.openAvgReturnPct != null ? (
        <p className="mt-1 text-xs text-zinc-500">
          Open mark-to-market avg{' '}
          <span className={`font-mono ${classForScore(sleeve.openAvgReturnPct)}`}>{pct(sleeve.openAvgReturnPct)}</span>
        </p>
      ) : null}
      {recentMonths.length ? (
        <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
          {recentMonths.map((row) => (
            <div key={row.month} className="flex justify-between gap-3">
              <span>{row.month}</span>
              <span className={`font-mono ${classForScore(row.returnPct)}`}>
                {pct(row.returnPct)} · {row.weekCount ?? 0}w
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ForwardScoreboard({ forwardTest }: { forwardTest?: CotForwardTest | null }) {
  if (!forwardTest) return null;
  if (forwardTest.error) {
    return (
      <section className="rounded-2xl border border-amber-900/50 bg-amber-950/30 p-6 text-sm text-amber-100">
        Forward test unavailable: {forwardTest.error}
      </section>
    );
  }
  const sleeves = forwardTest.sleeves || [];
  if (!sleeves.length) return null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Paper test</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">Method scoreboard</h2>
      {forwardTest.method ? <p className="mt-2 max-w-4xl text-sm text-zinc-400">{forwardTest.method}</p> : null}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {sleeves.map((sleeve) => (
          <SleeveCard key={sleeve.key} sleeve={sleeve} />
        ))}
      </div>
    </section>
  );
}

function CotChartCard({ chart }: { chart: CotChartMarket }) {
  const stance = chart.stance || chart.signal;
  const trajectory = chart.trajectory || chart.netTrend || chart.changeTone;
  const latest = chart.series[chart.series.length - 1];
  const longShare =
    chart.longSharePct != null
      ? chart.longSharePct
      : latest && latest.long + latest.short > 0
        ? Math.round((latest.long / (latest.long + latest.short)) * 1000) / 10
        : null;
  const shortShare =
    chart.shortSharePct != null
      ? chart.shortSharePct
      : longShare != null
        ? Math.round((100 - longShare) * 10) / 10
        : null;
  const sides = chart.sides || {};

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{chart.group}</div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">{chart.label}</h3>
          <p className="text-xs text-zinc-500">
            {chart.trader} · {chart.contract || chart.label}
          </p>
        </div>
        {chart.extreme ? (
          <span className="rounded border border-amber-700/60 bg-amber-950/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-200">
            Extreme
          </span>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-base font-semibold ${stanceClass(stance)}`}>STANCE: {stance}</span>
        <span className="text-zinc-600">·</span>
        <span className={`text-base font-semibold capitalize ${trajectoryClass(String(trajectory))}`}>
          TRAJECTORY: {trajectory || '—'}
        </span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Wk ch {fmt(chart.specNetChange)}
        {trajectory === 'improving' ? ' ↑ covering / adding longs' : null}
        {trajectory === 'worsening' ? ' ↓ adding shorts / cutting longs' : null}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-400">
        <span>
          Split {longShare != null ? `${longShare.toFixed(0)}% L` : '—'} /{' '}
          {shortShare != null ? `${shortShare.toFixed(0)}% S` : '—'}
        </span>
        <span>Net {fmt(chart.specNet)}</span>
        <span>{fmtPct(chart.netPctOi)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <span className="text-zinc-500">
          Follow <span className={`font-semibold ${sideClass(sides.follow)}`}>{sides.follow || '—'}</span>
        </span>
        <span className="text-zinc-500">
          FadeExtreme <span className={`font-semibold ${sideClass(sides.fadeExtreme)}`}>{sides.fadeExtreme || '—'}</span>
        </span>
        <span className="text-zinc-500">
          Adaptive <span className={`font-semibold ${sideClass(sides.adaptive)}`}>{sides.adaptive || '—'}</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
        {chart.longTrend ? <span className="text-emerald-400/90">{chart.longTrend}</span> : null}
        {chart.shortTrend ? <span className="text-red-400/90">{chart.shortTrend}</span> : null}
        {chart.weeks ? <span>{chart.weeks} weekly reports</span> : null}
      </div>

      <div className="mt-4 grid gap-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 lg:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">6-month bars · long vs short</p>
          <CotBarChart series={chart.series} />
          <div className="mt-1 flex justify-center gap-5 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Long
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Short
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center border-t border-zinc-800 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Current split</p>
          <CotPieChart long={latest?.long ?? 0} short={latest?.short ?? 0} />
        </div>
      </div>
    </article>
  );
}

export default function CotReportClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<CotReportPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/cot', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load COT report.');
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

  const overall = data?.equitiesOverall;
  const charts = data?.charts ?? [];

  return (
    <>
      <ScannerExtrasNav active="/scanner/cot" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading COT report...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold">COT Positioning</h2>
            <p className="text-sm text-zinc-400">
              Report date: {data?.reportDate || 'n/a'} · logged in as {user.email}
            </p>
            {data?.generatedAt ? (
              <p className="text-xs text-zinc-500">Snapshot {new Date(data.generatedAt).toLocaleString()}</p>
            ) : null}
            <p className="mt-3 max-w-3xl text-sm text-zinc-400">
              Stance is where specs are now; trajectory is whether that net got more bullish or bearish this week.
              Green = long, red = short. Paper sleeves test Follow vs FadeExtreme vs Adaptive on 1× ETFs.
            </p>
            {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}
            {data?.message && !charts.length ? (
              <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
            ) : null}
          </section>

          <InstructionsLegend />

          <ForwardScoreboard forwardTest={data?.forwardTest} />

          {overall ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold">S&amp;P 500 snapshot</h3>
              <p className="mt-2 text-zinc-300">
                <span className={stanceClass(overall.stance || overall.signal)}>
                  STANCE: {overall.stance || overall.signal}
                </span>
                {' · '}
                <span className={`capitalize ${trajectoryClass(String(overall.trajectory || overall.changeTone))}`}>
                  TRAJECTORY: {overall.trajectory || overall.changeTone || '—'}
                </span>
                {' · '}
                net {overall.weightedNet.toLocaleString()} · change {overall.netChange.toLocaleString()}
              </p>
            </section>
          ) : null}

          {charts.length ? (
            <section className="grid gap-5 md:grid-cols-2">
              {charts.map((chart) => (
                <CotChartCard key={chart.id} chart={chart} />
              ))}
            </section>
          ) : (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
              Data is refreshing. Check back shortly.
            </section>
          )}

          {data?.note ? <p className="text-sm text-zinc-500">{data.note}</p> : null}
          {data?.discoveryStatus ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">{data.discoveryStatus}</p>
          ) : null}
        </div>
      )}
    </>
  );
}
