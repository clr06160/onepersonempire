'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChartFundamentals, ChartUniverseView } from '@/lib/charts/load-chart-data';

type ChartFundamentalsPanelProps = {
  fundamentals: ChartFundamentals;
  onSelectTicker?: (ticker: string) => void;
};

const UNIVERSE_KEYS = ['nasdaq100', 'sp500', 'midcap8b'] as const;
type UniverseKey = (typeof UNIVERSE_KEYS)[number];

const UNIVERSE_FALLBACK_LABELS: Record<UniverseKey, string> = {
  nasdaq100: 'NASDAQ-100',
  sp500: 'S&P 500',
  midcap8b: 'IWM Top 200',
};

function universeOptionLabel(key: UniverseKey, view?: ChartUniverseView) {
  const label = view?.universeLabel || UNIVERSE_FALLBACK_LABELS[key];
  const count = view?.universeCount;
  return count ? `${label} (${count})` : label;
}

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function num(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

function rankLabel(rank?: number | null, total?: number | null) {
  if (rank == null) return '—';
  if (total) return `#${rank}/${total}`;
  return `#${rank}`;
}

function growthClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-900';
  if (value >= 30) return 'text-emerald-700 font-semibold';
  if (value > 0) return 'text-emerald-600';
  if (value <= -10) return 'text-red-600 font-semibold';
  if (value < 0) return 'text-red-500';
  return 'text-zinc-900';
}

function reactionClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (value >= 5) return 'text-amber-700 font-semibold';
  if (value >= 3) return 'text-emerald-700 font-semibold';
  return '';
}

function resolveUniverseViews(fundamentals: ChartFundamentals): Record<UniverseKey, ChartUniverseView | undefined> {
  const views = fundamentals.universeViews;
  if (views) {
    return {
      nasdaq100: views.nasdaq100,
      sp500: views.sp500,
      midcap8b: views.midcap8b,
    };
  }
  if (fundamentals.rankings) {
    const legacy: ChartUniverseView = {
      ...fundamentals.rankings,
      universeShort: fundamentals.rankings.universeKey === 'sp500' ? 'SP500' : 'N100',
      inUniverse: true,
      topTen: fundamentals.topTen || {},
    };
    const key = (fundamentals.rankings.universeKey || 'nasdaq100') as UniverseKey;
    return {
      nasdaq100: key === 'nasdaq100' ? legacy : undefined,
      sp500: key === 'sp500' ? legacy : undefined,
      midcap8b: key === 'midcap8b' ? legacy : undefined,
    };
  }
  return { nasdaq100: undefined, sp500: undefined, midcap8b: undefined };
}

function UniverseRankBadges({
  views,
  rankKey,
}: {
  views: Record<UniverseKey, ChartUniverseView | undefined>;
  rankKey: keyof ChartUniverseView;
}) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {UNIVERSE_KEYS.map((key) => {
        const view = views[key];
        if (!view?.inUniverse) return null;
        const rank = view[rankKey];
        if (typeof rank !== 'number') return null;
        return (
          <span
            key={key}
            className="rounded bg-violet-100 px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-violet-800"
            title={view.universeLabel}
          >
            {view.universeShort} {rankLabel(rank, view.universeCount)}
          </span>
        );
      })}
    </span>
  );
}

function CompactStat({
  label,
  value,
  rankKey,
  views,
  className = 'text-zinc-900',
}: {
  label: string;
  value: string;
  rankKey?: keyof ChartUniverseView;
  views?: Record<UniverseKey, ChartUniverseView | undefined>;
  className?: string;
}) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs">
      <span className="font-medium text-zinc-700">{label}</span>
      <span className={`font-mono font-semibold ${className}`}>{value}</span>
      {rankKey && views ? <UniverseRankBadges views={views} rankKey={rankKey} /> : null}
    </span>
  );
}

function TopTenColumn({
  title,
  entries,
  format,
  activeTicker,
  onSelectTicker,
}: {
  title: string;
  entries: { rank: number; ticker: string; value: number | null }[];
  format: (value: number | null) => string;
  activeTicker: string;
  onSelectTicker?: (ticker: string) => void;
}) {
  return (
    <div className="min-w-[8.5rem] flex-1">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">{title}</p>
      <ul className="space-y-0.5 text-xs">
        {entries.map((entry) => {
          const active = entry.ticker === activeTicker;
          return (
            <li key={`${title}-${entry.rank}-${entry.ticker}`} className="flex items-center justify-between gap-2">
              <span className="font-mono text-zinc-600">{entry.rank}.</span>
              {onSelectTicker ? (
                <button
                  type="button"
                  onClick={() => onSelectTicker(entry.ticker)}
                  className={`flex-1 truncate text-left font-mono font-semibold hover:text-violet-700 ${
                    active ? 'text-violet-700' : 'text-zinc-800'
                  }`}
                >
                  {entry.ticker}
                </button>
              ) : (
                <span className={`flex-1 truncate font-mono font-semibold ${active ? 'text-violet-700' : 'text-zinc-800'}`}>
                  {entry.ticker}
                </span>
              )}
              <span className="font-mono text-zinc-600">{format(entry.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RankMatrix({
  views,
  growth,
}: {
  views: Record<UniverseKey, ChartUniverseView | undefined>;
  growth: ChartFundamentals['growth'];
}) {
  const rows: { label: string; rankKey: keyof ChartUniverseView }[] = [
    { label: 'Sales', rankKey: 'salesGrowthRank' },
    { label: 'EPS', rankKey: 'epsGrowthRank' },
    { label: 'Net Inc', rankKey: 'netIncomeGrowthRank' },
    { label: 'FCF', rankKey: 'fcfGrowthRank' },
    { label: 'Rule 40', rankKey: 'rule40Rank' },
    { label: 'Combined', rankKey: 'combinedRank' },
  ];

  return (
    <div className="mb-3 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="text-left text-zinc-700">
            <th className="py-1 pr-3 font-medium">Metric</th>
            <th className="py-1 pr-3 font-medium">Value</th>
            {UNIVERSE_KEYS.map((key) => (
              <th key={key} className="py-1 pr-3 font-medium whitespace-nowrap">
                {views[key]?.universeShort || UNIVERSE_FALLBACK_LABELS[key]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-zinc-200/80">
              <td className="py-1 pr-3 font-medium text-zinc-600">{row.label}</td>
              <td className="py-1 pr-3 font-mono font-semibold text-zinc-900">
                {row.label === 'Combined'
                  ? growth.combinedScore != null
                    ? String(growth.combinedScore)
                    : '—'
                  : pct(
                      growth[
                        row.rankKey === 'salesGrowthRank'
                          ? 'salesGrowthPct'
                          : row.rankKey === 'epsGrowthRank'
                            ? 'epsGrowthPct'
                            : row.rankKey === 'netIncomeGrowthRank'
                              ? 'netIncomeGrowthPct'
                              : row.rankKey === 'fcfGrowthRank'
                                ? 'fcfGrowthPct'
                                : 'rule40'
                      ],
                    )}
              </td>
              {UNIVERSE_KEYS.map((key) => {
                const view = views[key];
                const rank = view?.[row.rankKey];
                return (
                  <td key={`${row.label}-${key}`} className="py-1 pr-3 font-mono font-semibold text-violet-800">
                    {view?.inUniverse && typeof rank === 'number'
                      ? rankLabel(rank, view.universeCount)
                      : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ChartFundamentalsPanel({ fundamentals, onSelectTicker }: ChartFundamentalsPanelProps) {
  const { growth, quality, earnings, annualHistory } = fundamentals;
  const views = useMemo(() => resolveUniverseViews(fundamentals), [fundamentals]);

  const defaultUniverse =
    (fundamentals.primaryUniverseKey as UniverseKey) ||
    UNIVERSE_KEYS.find((key) => views[key]?.inUniverse) ||
    'nasdaq100';

  const [universeKey, setUniverseKey] = useState<UniverseKey>(defaultUniverse);

  useEffect(() => {
    setUniverseKey(defaultUniverse);
  }, [fundamentals.ticker, defaultUniverse]);

  const activeView = views[universeKey];
  const topTen = activeView?.topTen;

  const subtitle = [fundamentals.company, fundamentals.sector, fundamentals.industry]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="border-t border-zinc-200 bg-white px-4 py-3">
      {subtitle ? <p className="mb-3 text-sm text-zinc-600">{subtitle}</p> : null}

      {/* 1. Rankings + Top 10 */}
      <section className="mb-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Rankings</p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-700">
            Rank universe
            <select
              value={universeKey}
              onChange={(event) => setUniverseKey(event.target.value as UniverseKey)}
              className="min-w-[220px] rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900"
            >
              {UNIVERSE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {universeOptionLabel(key, views[key])}
                  {views[key]?.inUniverse
                    ? ` · ${fundamentals.ticker} ranked`
                    : ` · ${fundamentals.ticker} not in list`}
                </option>
              ))}
            </select>
          </label>
          {activeView?.inUniverse ? (
            <p className="text-xs text-zinc-700">
              {activeView.universeLabel}: {rankLabel(activeView.rule40Rank, activeView.universeCount)} Rule 40 ·{' '}
              {rankLabel(activeView.salesGrowthRank, activeView.universeCount)} Sales
            </p>
          ) : (
            <p className="text-xs text-amber-700">
              {fundamentals.ticker} is not in {activeView?.universeLabel || 'this universe'}.
            </p>
          )}
        </div>

        <RankMatrix views={views} growth={growth} />

        {topTen && (topTen.rule40?.length || topTen.salesGrowth?.length) ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
              Top 10 · {activeView?.universeLabel || UNIVERSE_FALLBACK_LABELS[universeKey]}
            </p>
            <div className="flex gap-3 overflow-x-auto pb-1">
              <TopTenColumn
                title="Rule 40"
                entries={topTen.rule40 || []}
                format={(v) => pct(v)}
                activeTicker={fundamentals.ticker}
                onSelectTicker={onSelectTicker}
              />
              <TopTenColumn
                title="Sales Gr"
                entries={topTen.salesGrowth || []}
                format={(v) => pct(v)}
                activeTicker={fundamentals.ticker}
                onSelectTicker={onSelectTicker}
              />
              <TopTenColumn
                title="EPS Gr"
                entries={topTen.epsGrowth || []}
                format={(v) => pct(v)}
                activeTicker={fundamentals.ticker}
                onSelectTicker={onSelectTicker}
              />
              <TopTenColumn
                title="Net Inc Gr"
                entries={topTen.netIncomeGrowth || []}
                format={(v) => pct(v)}
                activeTicker={fundamentals.ticker}
                onSelectTicker={onSelectTicker}
              />
              <TopTenColumn
                title="FCF Gr"
                entries={topTen.fcfGrowth || []}
                format={(v) => pct(v)}
                activeTicker={fundamentals.ticker}
                onSelectTicker={onSelectTicker}
              />
            </div>
          </div>
        ) : null}
      </section>

      {/* 2. Earnings */}
      <section className="mb-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Earnings</p>
        <div className="flex flex-wrap gap-1.5">
          <CompactStat label="Last EPS" value={earnings.latestEarningsDate || '—'} />
          <CompactStat label="Next EPS" value={earnings.nextEarningsDate || '—'} />
          <CompactStat
            label="D0"
            value={pct(earnings.immediateReactionPct)}
            className={growthClass(earnings.immediateReactionPct)}
          />
          <CompactStat
            label="D3"
            value={pct(earnings.threeDayReactionPct)}
            className={growthClass(earnings.threeDayReactionPct)}
          />
          <CompactStat
            label="React"
            value={earnings.reactionScore != null ? String(earnings.reactionScore) : '—'}
            className={reactionClass(earnings.reactionScore)}
          />
        </div>
      </section>

      {/* 3. Growth (all universes) */}
      <section className="mb-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Growth (all universes)</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <CompactStat
            label="Sales"
            value={pct(growth.salesGrowthPct)}
            rankKey="salesGrowthRank"
            views={views}
            className={growthClass(growth.salesGrowthPct)}
          />
          <CompactStat
            label="EPS"
            value={pct(growth.epsGrowthPct)}
            rankKey="epsGrowthRank"
            views={views}
            className={growthClass(growth.epsGrowthPct)}
          />
          <CompactStat
            label="Net Inc"
            value={pct(growth.netIncomeGrowthPct)}
            rankKey="netIncomeGrowthRank"
            views={views}
            className={growthClass(growth.netIncomeGrowthPct)}
          />
          <CompactStat
            label="FCF"
            value={pct(growth.fcfGrowthPct)}
            rankKey="fcfGrowthRank"
            views={views}
            className={growthClass(growth.fcfGrowthPct)}
          />
          <CompactStat
            label="GM Exp"
            value={pct(growth.grossMarginExpansionPct)}
            className={growthClass(growth.grossMarginExpansionPct)}
          />
          <CompactStat
            label="Rule 40"
            value={pct(growth.rule40)}
            rankKey="rule40Rank"
            views={views}
            className={growthClass(growth.rule40)}
          />
          <CompactStat
            label="Combined"
            value={growth.combinedScore != null ? String(growth.combinedScore) : '—'}
            rankKey="combinedRank"
            views={views}
          />
        </div>
      </section>

      {/* Quality + annual history */}
      <section className="mb-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Quality</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <CompactStat label="P/E" value={num(quality.peRatio)} />
          <CompactStat label="ROE" value={pct(quality.roePct)} />
          <CompactStat label="EBITDA" value={pct(quality.ebitdaMarginPct)} />
          <CompactStat label="NI Mgn" value={pct(quality.netIncomeMarginPct)} />
          <CompactStat label="Gross" value={pct(quality.grossMarginPct)} />
          <CompactStat label="MktCap B" value={num(quality.marketCapB)} />
          <CompactStat label="Rev B" value={num(quality.latestRevenueB)} />
          <CompactStat label="Div" value={pct(quality.dividendYieldPct)} />
          <CompactStat label="EPS FY" value={num(quality.eps, 2)} />
        </div>

        {annualHistory.length ? (
          <div className="overflow-x-auto">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Annual EPS &amp; revenue</p>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-700">
                  <th className="py-1 pr-3 font-medium">Year</th>
                  <th className="py-1 pr-3 font-medium">EPS</th>
                  <th className="py-1 font-medium">Rev B</th>
                </tr>
              </thead>
              <tbody>
                {annualHistory.map((row) => (
                  <tr key={row.year} className="border-b border-zinc-100">
                    <td className="py-1 pr-3 font-mono text-zinc-600">{row.year}</td>
                    <td className="py-1 pr-3 font-mono font-semibold text-zinc-900">
                      {row.eps != null ? row.eps.toFixed(2) : '—'}
                    </td>
                    <td className="py-1 font-mono font-semibold text-zinc-900">
                      {row.revenueB != null ? row.revenueB.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {fundamentals.financialDate ? (
        <p className="text-[11px] text-zinc-600">
          FY filed {fundamentals.financialDate} · {fundamentals.asOf}
        </p>
      ) : null}
    </div>
  );
}
