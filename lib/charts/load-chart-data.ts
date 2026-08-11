import { access, readFile } from 'fs/promises';
import path from 'path';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type ChartBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartOverlayPoint = {
  time: string;
  value: number;
};

export type ChartAnnualFundamental = {
  year: string;
  eps: number | null;
  revenueB: number | null;
};

export type ChartTopTenEntry = {
  rank: number;
  ticker: string;
  value: number | null;
};

export type ChartFundamentalsRankings = {
  universeKey: string;
  universeLabel: string;
  universeCount: number | null;
  salesGrowthRank: number | null;
  epsGrowthRank: number | null;
  netIncomeGrowthRank: number | null;
  fcfGrowthRank: number | null;
  rule40Rank: number | null;
  combinedRank: number | null;
};

export type ChartUniverseView = ChartFundamentalsRankings & {
  universeShort: string;
  inUniverse: boolean;
  topTen: {
    rule40?: ChartTopTenEntry[];
    salesGrowth?: ChartTopTenEntry[];
    epsGrowth?: ChartTopTenEntry[];
    netIncomeGrowth?: ChartTopTenEntry[];
    fcfGrowth?: ChartTopTenEntry[];
  };
};

export type ChartFundamentals = {
  ticker: string;
  asOf: string;
  company: string;
  sector: string;
  industry: string;
  financialDate: string;
  primaryUniverseKey?: string;
  universeViews?: {
    nasdaq100?: ChartUniverseView;
    sp500?: ChartUniverseView;
    midcap8b?: ChartUniverseView;
  };
  rankings?: ChartFundamentalsRankings;
  topTen?: {
    rule40?: ChartTopTenEntry[];
    salesGrowth?: ChartTopTenEntry[];
    epsGrowth?: ChartTopTenEntry[];
    netIncomeGrowth?: ChartTopTenEntry[];
    fcfGrowth?: ChartTopTenEntry[];
  };
  growth: {
    salesGrowthPct: number | null;
    epsGrowthPct: number | null;
    netIncomeGrowthPct: number | null;
    fcfGrowthPct: number | null;
    grossMarginExpansionPct: number | null;
    rule40: number | null;
    combinedScore: number | null;
  };
  quality: {
    peRatio: number | null;
    roePct: number | null;
    ebitdaMarginPct: number | null;
    netIncomeMarginPct: number | null;
    grossMarginPct: number | null;
    marketCapB: number | null;
    latestRevenueB: number | null;
    dividendYieldPct: number | null;
    eps: number | null;
  };
  earnings: {
    latestEarningsDate: string | null;
    nextEarningsDate: string | null;
    immediateReactionPct: number | null;
    threeDayReactionPct: number | null;
    reactionScore: number | null;
  };
  annualHistory: ChartAnnualFundamental[];
  source: string;
};

export type ChartKeltnerOverlay = {
  length: number;
  multiplier: number;
  middle: ChartOverlayPoint[];
  upper: ChartOverlayPoint[];
  lower: ChartOverlayPoint[];
};

export type ChartElliottWaveQuote = {
  label: string;
  rawLabel?: string;
  phase: string;
  direction: 'up' | 'down' | 'neutral';
  targets: Array<{ label: string; price: number; kind: 'high' | 'low' }>;
  waveHigh?: number | null;
  waveLow?: number | null;
};

export type ScannerChartPayload = {
  ticker: string;
  asOf: string;
  source?: string;
  bars: ChartBar[];
  overlays: {
    sma50: ChartOverlayPoint[];
    sma200: ChartOverlayPoint[];
    ema10: ChartOverlayPoint[];
    keltner?: ChartKeltnerOverlay;
  };
  fundamentals?: ChartFundamentals | null;
  elliottWave?: ChartElliottWaveQuote | null;
};

export type ChartManifest = {
  generatedAt: string;
  bars: number;
  years?: number;
  tickerSource?: string;
  tickers: string[];
  missed: string[];
};

function chartBucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function safeTicker(ticker: string) {
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, '');
}

function chartObjectName(ticker: string) {
  return `scanner/charts/${safeTicker(ticker)}.json`;
}

async function loadChartDataFromGcs(ticker: string): Promise<ScannerChartPayload | null> {
  const bucketName = chartBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage()
    .bucket(bucketName)
    .file(chartObjectName(ticker))
    .download();

  return JSON.parse(content.toString('utf8')) as ScannerChartPayload;
}

async function resolveLocalChartsDir(): Promise<string | null> {
  const candidates = [
    process.env.SCANNER_CHARTS_LOCAL_DIR,
    process.env.NODE_ENV === 'development'
      ? path.resolve(process.cwd(), '../Projects/stocks/scanners/charts')
      : null,
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      await access(path.join(dir, 'manifest.json'));
      return dir;
    } catch {
      continue;
    }
  }
  return null;
}

async function loadChartDataFromFile(ticker: string): Promise<ScannerChartPayload | null> {
  const baseDir = await resolveLocalChartsDir();
  if (!baseDir) return null;

  const filePath = path.join(baseDir, `${safeTicker(ticker)}.json`);
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as ScannerChartPayload;
  } catch {
    return null;
  }
}

export async function loadChartData(ticker: string): Promise<ScannerChartPayload | null> {
  const normalized = safeTicker(ticker);
  if (!normalized) return null;

  if (process.env.NODE_ENV === 'development') {
    const localData = await loadChartDataFromFile(normalized);
    if (localData) return localData;
  }

  try {
    const cloudData = await loadChartDataFromGcs(normalized);
    if (cloudData) return cloudData;
  } catch {
    // Fall through to local file for dev fallback.
  }

  return loadChartDataFromFile(normalized);
}

async function loadManifestFromGcs(): Promise<ChartManifest | null> {
  const bucketName = chartBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage()
    .bucket(bucketName)
    .file('scanner/charts/manifest.json')
    .download();

  return JSON.parse(content.toString('utf8')) as ChartManifest;
}

async function loadManifestFromFile(): Promise<ChartManifest | null> {
  const baseDir = await resolveLocalChartsDir();
  if (!baseDir) return null;

  try {
    const raw = await readFile(path.join(baseDir, 'manifest.json'), 'utf8');
    return JSON.parse(raw) as ChartManifest;
  } catch {
    return null;
  }
}

export async function loadChartManifest(): Promise<ChartManifest | null> {
  if (process.env.NODE_ENV === 'development') {
    const localManifest = await loadManifestFromFile();
    if (localManifest) return localManifest;
  }

  try {
    const cloudManifest = await loadManifestFromGcs();
    if (cloudManifest) return cloudManifest;
  } catch {
    // Fall through to local file.
  }

  return loadManifestFromFile();
}
