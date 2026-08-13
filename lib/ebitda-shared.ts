export type EbitdaQuarter = {
  period: string;
  ebitdaMargin: number;
  revenueM?: number;
};

export type EbitdaName = {
  ticker: string;
  name: string;
  sector?: string;
  /** Universe sleeves this name belongs to (nasdaq100, sp500, russell, …). */
  universes?: string[];
  ebitdaMarginLatest: number;
  ebitdaMarginPrior: number;
  marginDeltaPp: number;
  revenueGrowthYoY?: number | null;
  above200dma?: boolean | null;
  asOf?: string;
  why?: string;
  quarters: EbitdaQuarter[];
};

export type EbitdaForwardPosition = {
  ticker: string;
  company?: string;
  entryDate?: string;
  entryPrice?: number | null;
  lastDate?: string;
  lastPrice?: number | null;
  currentReturnPct?: number | null;
  returnPct?: number | null;
  daysHeld?: number | null;
  entryRank?: number | null;
  lastRank?: number | null;
  status?: string;
  exitDate?: string;
  exitPrice?: number | null;
};

export type EbitdaForwardUniverse = {
  key: string;
  label: string;
  openCount?: number;
  currentTickers?: string[];
  lastAsOf?: string;
  equity?: number | null;
  totalReturnPct?: number | null;
  maxDrawdownPct?: number | null;
  openAvgReturnPct?: number | null;
  summary?: {
    periodCount?: number;
    avgPeriodReturnPct?: number | null;
    totalReturnPct?: number | null;
    hitRatePct?: number | null;
    closedCount?: number;
  };
  openPositions?: EbitdaForwardPosition[];
  recentClosed?: EbitdaForwardPosition[];
  recentPeriods?: Array<{
    from?: string;
    to?: string;
    returnPct?: number | null;
    tickers?: string[];
    count?: number;
  }>;
};

export type EbitdaForwardTest = {
  asOf?: string;
  updatedAt?: string;
  method?: string;
  topN?: number;
  universes?: EbitdaForwardUniverse[];
  note?: string;
};

export type EbitdaPayload = {
  connected: boolean;
  generatedAt?: string;
  universe?: string;
  note?: string;
  message?: string;
  source?: string;
  method?: string[];
  names: EbitdaName[];
  forwardTest?: EbitdaForwardTest | null;
};

export function filterEbitdaNames(
  names: EbitdaName[],
  options: {
    minDeltaPp?: number;
    requireNonCollapsingRevenue?: boolean;
    requireAbove200dma?: boolean;
    universeKey?: string | null;
  } = {},
) {
  const minDeltaPp = options.minDeltaPp ?? 0;
  return names.filter((name) => {
    if (name.marginDeltaPp < minDeltaPp) return false;
    if (options.requireNonCollapsingRevenue && (name.revenueGrowthYoY ?? 0) < 0) return false;
    if (options.requireAbove200dma && name.above200dma !== true) return false;
    if (options.universeKey) {
      const sleeves = name.universes || [];
      if (!sleeves.includes(options.universeKey)) return false;
    }
    return true;
  });
}
