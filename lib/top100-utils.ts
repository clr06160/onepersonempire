import type { Top100Payload, Top100Row } from '@/lib/scanner-top100-data';

export const DEFAULT_SORT_OPTIONS = [
  { key: 'ytd', label: 'YTD %', ascending: false },
  { key: 'pct5d', label: '5-Day %', ascending: false },
  { key: 'pct1m', label: '1-Month %', ascending: false },
  { key: 'pct3m', label: '3-Month %', ascending: false },
  { key: 'pct52w', label: '52-Week %', ascending: false },
  { key: 'pct2y', label: '2-Year %', ascending: false },
  { key: 'pct3y', label: '3-Year %', ascending: false },
  { key: 'pct5y', label: '5-Year %', ascending: false },
  { key: 'pct10y', label: '10-Year %', ascending: false },
  { key: 'weightedAlpha', label: 'Weighted Alpha', ascending: false },
] as const;

export const DEFAULT_UNIVERSE_OPTIONS = [
  { key: 'sp500', label: 'S&P 500' },
  { key: 'nasdaq100', label: 'NASDAQ-100' },
  { key: 'midcap100', label: 'MidCap 100' },
  { key: 'russell', label: 'Russell (broad)' },
] as const;

const SORT_FIELD: Record<string, { field: keyof Top100Row; ascending: boolean }> = {
  ytd: { field: 'ytd', ascending: false },
  pct5d: { field: 'pct5d', ascending: false },
  pct1m: { field: 'pct1m', ascending: false },
  pct3m: { field: 'pct3m', ascending: false },
  pct52w: { field: 'pct52w', ascending: false },
  pct2y: { field: 'pct2y', ascending: false },
  pct3y: { field: 'pct3y', ascending: false },
  pct5y: { field: 'pct5y', ascending: false },
  pct10y: { field: 'pct10y', ascending: false },
  weightedAlpha: { field: 'weightedAlpha', ascending: false },
};

export function universeOptions(data: Top100Payload | null) {
  return data?.universeOptions?.length ? data.universeOptions : DEFAULT_UNIVERSE_OPTIONS;
}

export function sortOptions(data: Top100Payload | null) {
  return data?.sortOptions?.length ? data.sortOptions : DEFAULT_SORT_OPTIONS;
}

export function sourceRows(data: Top100Payload | null, universeKey: string): Top100Row[] {
  if (data?.universes?.[universeKey]?.rows?.length) {
    return data.universes[universeKey].rows as Top100Row[];
  }
  if ((data?.universe || data?.defaultUniverse) === universeKey && data?.rows?.length) {
    return data.rows;
  }
  return data?.rows || [];
}

export function sortedRows(
  data: Top100Payload | null,
  universeKey: string,
  sortKey: string,
  ascendingOverride?: boolean,
): Top100Row[] {
  const cfg = SORT_FIELD[sortKey] || SORT_FIELD.ytd;
  const ascending = ascendingOverride ?? cfg.ascending;
  const rows = [...sourceRows(data, universeKey)];
  rows.sort((a, b) => {
    const av = a[cfg.field];
    const bv = b[cfg.field];
    const aMissing = av === null || av === undefined || Number.isNaN(Number(av));
    const bMissing = bv === null || bv === undefined || Number.isNaN(Number(bv));
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return ascending ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });
  return rows.slice(0, data?.topN || 100).map((row, index) => ({ ...row, rank: index + 1 }));
}

export function universeMeta(data: Top100Payload | null, universeKey: string) {
  return (
    data?.universes?.[universeKey] || {
      label: data?.universeLabel,
      tickerCount: data?.tickerCount,
    }
  );
}
