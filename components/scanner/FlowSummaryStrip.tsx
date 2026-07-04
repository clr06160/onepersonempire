'use client';

import Link from 'next/link';

import type { FlowPublicSummary, FlowStrength, FlowTrendBias, FlowBias } from '@/lib/scanner-flow-data';

function strengthDots(strength: FlowStrength) {
  const count = strength === 'strong' ? 3 : strength === 'moderate' ? 2 : 1;
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= count ? 'bg-current opacity-90' : 'bg-current opacity-20'}`}
        />
      ))}
    </span>
  );
}

function optionsIcon(bias: FlowBias) {
  if (bias === 'call_heavy') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="currentColor" d="M12 4l7 8h-4v8h-6v-8H5l7-8z" />
      </svg>
    );
  }
  if (bias === 'put_heavy') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="currentColor" d="M12 20l7-8h-4V4H9v8H5l7 8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="currentColor" d="M5 12h14" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function trendIcon(bias: FlowTrendBias) {
  if (bias === 'accumulating') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="currentColor" d="M4 16l6-6 4 4 6-8 2 2v8H4z" />
      </svg>
    );
  }
  if (bias === 'distributing') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
        <path fill="currentColor" d="M4 8h16v8h-2v-4l-6 6-4-4-4 4V8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="currentColor" d="M4 11h16v2H4z" />
    </svg>
  );
}

function badgeClass(kind: 'options' | 'institutional' | 'volume', bias: FlowBias | FlowTrendBias) {
  if (bias === 'call_heavy' || bias === 'accumulating') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (bias === 'put_heavy' || bias === 'distributing') return 'border-red-300 bg-red-50 text-red-800';
  return 'border-zinc-300 bg-zinc-50 text-zinc-700';
}

function labelForOptions(bias: FlowBias) {
  if (bias === 'call_heavy') return 'Call lean';
  if (bias === 'put_heavy') return 'Put lean';
  return 'Neutral';
}

function labelForTrend(bias: FlowTrendBias) {
  if (bias === 'accumulating') return 'Accumulating';
  if (bias === 'distributing') return 'Distributing';
  return 'Mixed';
}

type FlowSummaryStripProps = {
  ticker?: string;
  summary: FlowPublicSummary | null;
  loading?: boolean;
  showLink?: boolean;
  isDeveloper?: boolean;
  compact?: boolean;
};

export default function FlowSummaryStrip({
  ticker,
  summary,
  loading = false,
  showLink = true,
  isDeveloper = false,
  compact = true,
}: FlowSummaryStripProps) {
  const href = ticker ? `/scanner/options-institutions?ticker=${encodeURIComponent(ticker)}` : '/scanner/options-institutions';
  const shellClass = compact
    ? 'rounded-xl border border-zinc-300 bg-white p-4 shadow-sm'
    : 'rounded-xl border border-zinc-300 bg-white p-6 shadow-sm';

  if (loading) {
    return (
      <aside className={shellClass}>
        <p className="text-sm text-zinc-500">Loading flow summary…</p>
      </aside>
    );
  }

  if (!summary) {
    return (
      <aside className={shellClass}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-800">Options / institutions</span>
          {showLink ? (
            <Link href={href} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
              Open →
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-zinc-600">
          {ticker ? `No flow summary for ${ticker} yet.` : 'Load a ticker to see options and institutional bias.'}
        </p>
      </aside>
    );
  }

  const items = [
    {
      key: 'options',
      title: 'Options',
      bias: summary.options.bias,
      strength: summary.options.strength,
      available: summary.options.available,
      kind: 'options' as const,
    },
    {
      key: 'institutional',
      title: 'Institutions',
      bias: summary.institutional.bias,
      strength: summary.institutional.strength,
      available: summary.institutional.available,
      kind: 'institutional' as const,
    },
    {
      key: 'volume',
      title: 'Volume',
      bias: summary.volume.bias,
      strength: summary.volume.strength,
      available: summary.volume.available,
      kind: 'volume' as const,
    },
  ];

  return (
    <aside className={shellClass}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-zinc-800">
          {ticker ? `${ticker} flow` : 'Options / institutions'}
        </span>
        {showLink ? (
          <Link href={href} className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            {isDeveloper ? 'Details →' : 'Open →'}
          </Link>
        ) : null}
      </div>

      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{summary.signal}</p>

      <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:max-w-xl'}`}>
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex flex-col items-center rounded-lg border px-2 py-3 text-center ${badgeClass(item.kind, item.bias)}`}
            title={item.title}
          >
            <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">{item.title}</span>
            <span className="mb-1">
              {item.kind === 'options'
                ? optionsIcon(item.bias as FlowBias)
                : trendIcon(item.bias as FlowTrendBias)}
            </span>
            <span className="text-[11px] font-semibold leading-tight">
              {item.kind === 'options'
                ? labelForOptions(item.bias as FlowBias)
                : labelForTrend(item.bias as FlowTrendBias)}
            </span>
            {item.available ? (
              <span className="mt-1">{strengthDots(item.strength)}</span>
            ) : (
              <span className="mt-1 text-[10px] opacity-70">N/A</span>
            )}
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-snug text-zinc-500">
        Qualitative summary only{isDeveloper ? ' — open Details for licensed FMP numbers.' : '.'}
      </p>
    </aside>
  );
}
