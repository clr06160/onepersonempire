export type EbitdaQuarter = {
  period: string;
  ebitdaMargin: number;
  revenueM?: number;
};

export type EbitdaName = {
  ticker: string;
  name: string;
  sector?: string;
  ebitdaMarginLatest: number;
  ebitdaMarginPrior: number;
  marginDeltaPp: number;
  revenueGrowthYoY?: number | null;
  above200dma?: boolean | null;
  asOf?: string;
  why?: string;
  quarters: EbitdaQuarter[];
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
};

export function filterEbitdaNames(
  names: EbitdaName[],
  options: {
    minDeltaPp?: number;
    requireNonCollapsingRevenue?: boolean;
    requireAbove200dma?: boolean;
  } = {},
) {
  const minDeltaPp = options.minDeltaPp ?? 0;
  return names.filter((name) => {
    if (name.marginDeltaPp < minDeltaPp) return false;
    if (options.requireNonCollapsingRevenue && (name.revenueGrowthYoY ?? 0) < 0) return false;
    if (options.requireAbove200dma && name.above200dma !== true) return false;
    return true;
  });
}
