import type { FmpScreenerPayload, FmpScreenerRow } from '@/lib/scanner-fmp-data';

export const DEFAULT_SORT_OPTIONS = [
  { key: 'combined', label: 'Combined Score (Rule40 + Net Income Growth)', ascending: true },
  { key: 'rule40', label: 'Rule of 40', ascending: false },
  { key: 'net_income_growth', label: 'Net Income Growth %', ascending: false },
  { key: 'sales_growth', label: 'Sales Growth %', ascending: false },
  { key: 'eps_growth', label: 'EPS Growth %', ascending: false },
  { key: 'fcf_growth', label: 'FCF Growth %', ascending: false },
  { key: 'gross_margin_expansion', label: 'Gross Margin Expansion %', ascending: false },
  { key: 'earnings_reaction', label: 'Earnings Reaction Score', ascending: false },
  { key: 'immediate_reaction', label: 'Immediate Reaction %', ascending: false },
  { key: 'three_day_reaction', label: '3-Day Reaction %', ascending: false },
] as const;

export const DEFAULT_UNIVERSE_OPTIONS = [
  { key: 'nasdaq100', label: 'NASDAQ-100' },
  { key: 'sp500', label: 'S&P 500' },
  { key: 'midcap8b', label: 'Larger Mid-Caps ($8B+)' },
] as const;

const SORT_FIELD: Record<string, { field: keyof FmpScreenerRow; ascending: boolean }> = {
  combined: { field: 'combinedScore', ascending: true },
  rule40: { field: 'rule40', ascending: false },
  net_income_growth: { field: 'netIncomeGrowthPct', ascending: false },
  sales_growth: { field: 'salesGrowthPct', ascending: false },
  eps_growth: { field: 'epsGrowthPct', ascending: false },
  fcf_growth: { field: 'fcfGrowthPct', ascending: false },
  gross_margin_expansion: { field: 'grossMarginExpansionPct', ascending: false },
  earnings_reaction: { field: 'earningsReactionScore', ascending: false },
  immediate_reaction: { field: 'immediateReactionPct', ascending: false },
  three_day_reaction: { field: 'threeDayReactionPct', ascending: false },
};

export function universeOptions(data: FmpScreenerPayload | null) {
  return data?.universeOptions?.length ? data.universeOptions : DEFAULT_UNIVERSE_OPTIONS;
}

export function sortOptions(data: FmpScreenerPayload | null) {
  return data?.sortOptions?.length ? data.sortOptions : DEFAULT_SORT_OPTIONS;
}

export function sourceRows(data: FmpScreenerPayload | null, universeKey: string): FmpScreenerRow[] {
  if (data?.universes?.[universeKey]?.rows?.length) {
    return data.universes[universeKey].rows;
  }
  if ((data?.universe || data?.defaultUniverse) === universeKey && data?.rows?.length) {
    return data.rows;
  }
  return data?.rows || [];
}

export function sortedRows(
  data: FmpScreenerPayload | null,
  universeKey: string,
  sortKey: string,
): FmpScreenerRow[] {
  const cfg = SORT_FIELD[sortKey] || SORT_FIELD.combined;
  const rows = [...sourceRows(data, universeKey)];
  rows.sort((a, b) => {
    const av = a[cfg.field];
    const bv = b[cfg.field];
    const aMissing = av === null || av === undefined || Number.isNaN(Number(av));
    const bMissing = bv === null || bv === undefined || Number.isNaN(Number(bv));
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return cfg.ascending ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });
  return rows.slice(0, data?.topN || 30).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function universeMeta(data: FmpScreenerPayload | null, universeKey: string) {
  return (
    data?.universes?.[universeKey] || {
      label: data?.universeLabel,
      tickerCount: data?.tickerCount,
    }
  );
}
