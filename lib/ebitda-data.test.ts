import assert from 'node:assert/strict';
import test from 'node:test';

type EbitdaName = {
  ticker: string;
  name: string;
  ebitdaMarginLatest: number;
  ebitdaMarginPrior: number;
  marginDeltaPp: number;
  revenueGrowthYoY?: number | null;
  above200dma?: boolean | null;
  quarters: [];
};

function filterEbitdaNames(
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

const names: EbitdaName[] = [
  {
    ticker: 'APP',
    name: 'AppLovin',
    ebitdaMarginLatest: 41,
    ebitdaMarginPrior: 28,
    marginDeltaPp: 13,
    revenueGrowthYoY: 14,
    above200dma: true,
    quarters: [],
  },
  {
    ticker: 'EXMP',
    name: 'Example',
    ebitdaMarginLatest: 19,
    ebitdaMarginPrior: 12,
    marginDeltaPp: 7,
    revenueGrowthYoY: -18,
    above200dma: false,
    quarters: [],
  },
];

test('filterEbitdaNames keeps expanding margins by default', () => {
  const filtered = filterEbitdaNames(names, { minDeltaPp: 5 });
  assert.deepEqual(
    filtered.map((row) => row.ticker),
    ['APP', 'EXMP'],
  );
});

test('filterEbitdaNames can drop collapsing revenue and below-200dma names', () => {
  const filtered = filterEbitdaNames(names, {
    minDeltaPp: 5,
    requireNonCollapsingRevenue: true,
    requireAbove200dma: true,
  });
  assert.deepEqual(
    filtered.map((row) => row.ticker),
    ['APP'],
  );
});
