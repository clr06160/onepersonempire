'use client';

import { useMemo } from 'react';

import type { FlowChartPoint } from '@/lib/scanner-flow-data';

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

function compactNum(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

export function FlowBarChart({
  series,
  longLabel,
  shortLabel,
}: {
  series: FlowChartPoint[];
  longLabel: string;
  shortLabel: string;
}) {
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

    return { w, h, pad, innerH, bars, yTicks, xLabels, longLabel, shortLabel };
  }, [longLabel, series, shortLabel]);

  if (!plot) return null;

  return (
    <div>
      <svg viewBox={`0 0 ${plot.w} ${plot.h}`} className="w-full" role="img" aria-label={`${plot.longLabel} versus ${plot.shortLabel}`}>
        {plot.yTicks.map((tick) => (
          <g key={tick.label}>
            <line x1={plot.pad.l} x2={plot.w - plot.pad.r} y1={tick.y} y2={tick.y} stroke="#d4d4d8" strokeWidth="1" />
            <text x={plot.pad.l - 6} y={tick.y + 4} textAnchor="end" fill="#71717a" fontSize="10">
              {tick.label}
            </text>
          </g>
        ))}
        <line
          x1={plot.pad.l}
          x2={plot.w - plot.pad.r}
          y1={plot.pad.t + plot.innerH}
          y2={plot.pad.t + plot.innerH}
          stroke="#a1a1aa"
          strokeWidth="1"
        />
        {plot.bars.map((bar) => (
          <rect key={bar.key} x={bar.x} y={bar.y} width={bar.w} height={Math.max(bar.h, 0.5)} rx="1" fill={bar.fill} opacity={0.92} />
        ))}
        {plot.xLabels.map((lbl) => (
          <text key={lbl.label + lbl.x} x={lbl.x} y={plot.h - 10} textAnchor="middle" fill="#71717a" fontSize="9">
            {lbl.label}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          {plot.longLabel}
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          {plot.shortLabel}
        </span>
      </div>
    </div>
  );
}

export function FlowPieChart({
  long,
  short,
  longLabel,
  shortLabel,
  centerLabel,
}: {
  long: number;
  short: number;
  longLabel: string;
  shortLabel: string;
  centerLabel?: string;
}) {
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
      center: centerLabel || (longPct >= shortPct ? longLabel : shortLabel),
    };
  }, [centerLabel, long, longLabel, short, shortLabel]);

  if (!pie) return null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 140" className="h-36 w-36" role="img" aria-label={`${longLabel} versus ${shortLabel}`}>
        <path d={pie.longPath} fill="#34d399" />
        <path d={pie.shortPath} fill="#f87171" />
        <circle cx={pie.cx} cy={pie.cy} r={26} fill="#ffffff" stroke="#e4e4e7" />
        <text x={pie.cx} y={pie.cy + 4} textAnchor="middle" fill="#27272a" fontSize="9" fontWeight="600">
          {pie.center}
        </text>
      </svg>
      <div className="mt-2 space-y-1 text-xs text-zinc-600">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          {longLabel} {pie.longPct.toFixed(0)}%
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          {shortLabel} {pie.shortPct.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
