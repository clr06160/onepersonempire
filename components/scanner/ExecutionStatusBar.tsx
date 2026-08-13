import Link from 'next/link';

import type { LensForwardSnapshot } from '@/lib/scanner-pick-context';

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function returnClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-400';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-red-300';
  return 'text-zinc-300';
}

export default function ExecutionStatusBar({
  lenses,
  symmetric,
}: {
  lenses: LensForwardSnapshot[];
  symmetric?: boolean;
}) {
  if (!lenses.length) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Forward paper — which lens is working?</p>
      <div className={`mt-3 ${symmetric ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'flex flex-wrap gap-3'}`}>
        {lenses.map((lens) => (
          <Link
            key={lens.href}
            href={lens.href}
            className={`rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-3 transition hover:border-zinc-600 ${
              symmetric ? 'flex h-full min-h-[5.5rem] flex-col' : 'min-w-[180px] flex-1'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">{lens.label}</p>
            <p className="mt-1 text-lg font-bold text-zinc-100">{money(lens.equity)}</p>
            <p className={`text-sm font-semibold ${returnClass(lens.totalReturnPct)}`}>{pct(lens.totalReturnPct)}</p>
            {lens.asOf ? <p className="mt-1 text-[11px] text-zinc-500">As of {lens.asOf}</p> : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
