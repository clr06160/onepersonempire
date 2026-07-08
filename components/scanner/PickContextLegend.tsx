import type { ReactNode } from 'react';

function LegendChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}>
      {label}
    </span>
  );
}

function LegendRow({ chip, title, detail }: { chip: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 pt-0.5">{chip}</div>
      <div>
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <p className="text-xs leading-relaxed text-zinc-500">{detail}</p>
      </div>
    </div>
  );
}

export default function PickContextLegend() {
  return (
    <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <h3 className="font-semibold text-zinc-100">Pick chips legend</h3>
      <p className="mt-1 text-xs text-zinc-500">Shown on each Top Names row. Red row = hard avoid.</p>
      <div className="mt-4 space-y-3">
        <LegendRow
          chip={<LegendChip label="Avoid" className="border-red-700 bg-red-950 text-red-100" />}
          title="Hard veto"
          detail="Bear/Canary animal, music-stops risk ≥ 78, distributing flow, or theme rotating out/down."
        />
        <LegendRow
          chip={<LegendChip label="Top 10" className="border-emerald-700/70 bg-emerald-950/60 text-emerald-200" />}
          title="Top Ten book"
          detail="Name is in the equal-weight Top Ten forward paper portfolio."
        />
        <LegendRow
          chip={<LegendChip label="Cheetah" className="border-emerald-800/70 bg-emerald-950/40 text-emerald-200" />}
          title="Animal"
          detail="Valuation animal from Forest. Bear/Canary are vetoes; Cheetah/Dragon tend to be momentum-friendly."
        />
        <LegendRow
          chip={<LegendChip label="Run 52" className="border-emerald-900/60 bg-emerald-950/30 text-emerald-200" />}
          title="Runway"
          detail="Runway score — higher is more room. Low scores tint red."
        />
        <LegendRow
          chip={<LegendChip label="Risk 45" className="border-zinc-700 bg-zinc-900 text-zinc-300" />}
          title="Music stops"
          detail="Music-stops risk — spikes red at 78+ (Top Ten veto level)."
        />
        <LegendRow
          chip={<LegendChip label="Flow ↑" className="border-emerald-800/70 bg-emerald-950/50 text-emerald-200" />}
          title="Institutional flow"
          detail="Combined options, 13F, and volume lean. ↑ accumulating, ↓ distributing, ~ mixed."
        />
        <LegendRow
          chip={<LegendChip label="Theme ↓" className="border-red-900/70 bg-red-950/50 text-red-200" />}
          title="Theme rotation"
          detail="Named theme from Catalysts (AI layer, biotech, etc.). ↓ rotating out = hard avoid. Not every scan name has a theme — only ~half match a rule."
        />
        <LegendRow
          chip={<LegendChip label="Financials" className="border-zinc-800 bg-zinc-900/80 text-zinc-500" />}
          title="Sector only"
          detail="No theme tag — shows sector for context. Not a rotation signal."
        />
        <LegendRow
          chip={<LegendChip label="Earn 07-15" className="border-amber-700/70 bg-amber-950/50 text-amber-200" />}
          title="Earnings calendar"
          detail="Upcoming report on the reactor calendar. Amber = react score ≥ 3 (immediate pop last time)."
        />
      </div>
    </div>
  );
}
