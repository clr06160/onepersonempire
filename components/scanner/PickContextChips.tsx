import type { PickContext, PickThemeContext } from '@/lib/scanner-pick-context';

function flowTone(signal?: string) {
  const normalized = String(signal || 'MIXED').toUpperCase();
  if (normalized === 'ACCUMULATING') return 'border-emerald-800/70 bg-emerald-950/50 text-emerald-200';
  if (normalized === 'MOSTLY ACCUMULATING') return 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300/90';
  if (normalized === 'DISTRIBUTING') return 'border-red-900/70 bg-red-950/50 text-red-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function animalTone(animal?: string) {
  if (!animal) return 'border-zinc-700 bg-zinc-900 text-zinc-500';
  if (animal === 'Bear' || animal === 'Canary') return 'border-red-900/70 bg-red-950/50 text-red-200';
  if (animal === 'Cheetah' || animal === 'Dragon') return 'border-emerald-800/70 bg-emerald-950/40 text-emerald-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function scoreTone(value: number | null | undefined, invert = false) {
  if (value == null || Number.isNaN(value)) return 'border-zinc-700 bg-zinc-900 text-zinc-500';
  const hot = invert ? value >= 78 : value <= 35;
  const ok = invert ? value < 60 : value >= 50;
  if (hot) return 'border-red-900/70 bg-red-950/40 text-red-200';
  if (ok) return 'border-emerald-900/60 bg-emerald-950/30 text-emerald-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function Chip({ label, className, title }: { label: string; className: string; title?: string }) {
  return (
    <span
      title={title}
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

function themeChipMeta(theme: PickThemeContext) {
  const direction = theme.direction || 'Mixed';
  const stage = theme.stage || 'Mixed';
  if (themeIsVeto(direction, stage)) {
    return {
      label: 'Theme ↓',
      className: 'border-red-900/70 bg-red-950/50 text-red-200',
      title: `${theme.label} · ${direction} · ${stage}`,
    };
  }
  if (stage === 'Crowded') {
    return {
      label: 'Theme late',
      className: 'border-amber-800/70 bg-amber-950/40 text-amber-200',
      title: `${theme.label} · crowded theme`,
    };
  }
  if (direction === 'Rotating In' || stage === 'Leadership' || stage === 'Spreading') {
    return {
      label: 'Theme ↑',
      className: 'border-emerald-800/70 bg-emerald-950/50 text-emerald-200',
      title: `${theme.label} · ${direction} · ${stage}`,
    };
  }
  if (direction === 'Up') {
    return {
      label: 'Theme ↑',
      className: 'border-emerald-900/60 bg-emerald-950/30 text-emerald-300',
      title: `${theme.label} · ${direction} · ${stage}`,
    };
  }
  return {
    label: 'Theme ~',
    className: 'border-zinc-700 bg-zinc-900 text-zinc-400',
    title: `${theme.label} · ${direction} · ${stage}`,
  };
}

function themeIsVeto(direction?: string, stage?: string): boolean {
  const normalized = direction || 'Mixed';
  if (normalized === 'Rotating Out' || normalized === 'Down') return true;
  return stage === 'Fading' && normalized !== 'Rotating In' && normalized !== 'Up';
}

export default function PickContextChips({ context, inline }: { context?: PickContext; inline?: boolean }) {
  if (!context) {
    return <span className="text-[11px] text-zinc-600">No context yet</span>;
  }

  const flowShort = (() => {
    const s = String(context.flowSignal || 'MIXED').toUpperCase();
    if (s === 'ACCUMULATING') return 'Flow ↑';
    if (s === 'MOSTLY ACCUMULATING') return 'Flow ~↑';
    if (s === 'DISTRIBUTING') return 'Flow ↓';
    return 'Flow ~';
  })();

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${inline ? 'justify-start' : 'justify-end'}`}>
      {context.vetoed ? (
        <Chip
          label="Avoid"
          className="border-red-700 bg-red-950 text-red-100"
          title={context.vetoReasons.join(' · ')}
        />
      ) : null}
      {context.inTopTenBook ? (
        <Chip label="Top 10" className="border-emerald-700/70 bg-emerald-950/60 text-emerald-200" title="In Top Ten forward book" />
      ) : null}
      {context.animal ? (
        <Chip label={context.animal} className={animalTone(context.animal)} title="Valuation animal" />
      ) : null}
      {context.runwayScore != null ? (
        <Chip
          label={`Run ${Math.round(context.runwayScore)}`}
          className={scoreTone(context.runwayScore)}
          title="Runway score"
        />
      ) : null}
      {context.musicStopsRisk != null ? (
        <Chip
          label={`Risk ${Math.round(context.musicStopsRisk)}`}
          className={scoreTone(context.musicStopsRisk, true)}
          title="Music stops risk"
        />
      ) : null}
      {context.flowSignal ? (
        <Chip label={flowShort} className={flowTone(context.flowSignal)} title={context.flowSignal} />
      ) : null}
      {context.theme ? (() => {
        const meta = themeChipMeta(context.theme);
        return <Chip label={meta.label} className={meta.className} title={meta.title} />;
      })() : context.sector ? (
        <Chip
          label={context.sector}
          className="border-zinc-800 bg-zinc-900/80 text-zinc-500"
          title={`Sector: ${context.sector}${context.industry ? ` · ${context.industry}` : ''} (no theme tag)`}
        />
      ) : null}
      {context.earnings ? (
        <Chip
          label={
            context.earnings.reactionBadge === 'pass'
              ? 'Earn PASS+'
              : context.earnings.reactionBadge === 'fail'
                ? 'Earn FAIL−'
                : `Earn ${context.earnings.earningsDate.slice(5)}`
          }
          className={
            context.earnings.reactionBadge === 'pass'
              ? 'border-sky-600/70 bg-sky-950/70 text-sky-200'
              : context.earnings.reactionBadge === 'fail'
                ? 'border-red-700/70 bg-red-950/60 text-red-200'
                : (context.earnings.earningsReactionScore ?? 0) >= 3
                  ? 'border-amber-700/70 bg-amber-950/50 text-amber-200'
                  : 'border-violet-800/60 bg-violet-950/40 text-violet-200'
          }
          title={`Earnings ${context.earnings.earningsDate} · last 3d ${context.earnings.threeDayReactionPct ?? '—'}% · react ${context.earnings.earningsReactionScore ?? '—'}`}
        />
      ) : null}
    </div>
  );
}
