import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type ValuationScanContext = {
  systemId?: string;
  systemLabel?: string;
  role?: string;
  rank?: number | null;
  source?: string;
  universeKey?: string;
  universeLabel?: string;
};

export type ValuationAnimal = {
  animal: 'Cheetah' | 'Owl' | 'Bear' | 'Canary' | 'Turtle' | 'Dragon' | string;
  label: string;
  tone?: string;
};

export type ValuationRow = {
  rank?: number;
  ticker: string;
  company?: string;
  sector?: string;
  industry?: string;
  asOf?: string;
  systems?: string[];
  scanContexts?: ValuationScanContext[];
  price?: {
    price?: number | null;
    priceDate?: string | null;
    ma50?: number | null;
    ma200?: number | null;
    distanceFrom50dPct?: number | null;
    distanceFrom200dPct?: number | null;
    return3mPct?: number | null;
    return6mPct?: number | null;
    return12mPct?: number | null;
    drawdownFrom52wHighPct?: number | null;
    high52w?: number | null;
  };
  valuation?: {
    trailingPe?: number | null;
    priceToSales?: number | null;
    evToEbitda?: number | null;
    pePercentile?: number | null;
    psPercentile?: number | null;
    evEbitdaPercentile?: number | null;
    marketCapB?: number | null;
    latestRevenueB?: number | null;
    eps?: number | null;
    salesGrowthPct?: number | null;
    epsGrowthPct?: number | null;
    rule40?: number | null;
    historyYears?: number | null;
    financialDate?: string | null;
  };
  analyst?: {
    estimateDate?: string | null;
    nextFiscalEpsAvg?: number | null;
    nextFiscalRevenueB?: number | null;
    followingFiscalEpsAvg?: number | null;
    forwardEpsGrowthPct?: number | null;
    targetConsensus?: number | null;
    targetHigh?: number | null;
    targetLow?: number | null;
    targetUpdatedAt?: string | null;
    forwardPe?: number | null;
    forwardPeg?: number | null;
    targetUpsidePct?: number | null;
    targetSpreadPct?: number | null;
    source?: string;
  };
  scores?: {
    runwayScore?: number | null;
    musicStopsRisk?: number | null;
    valuationStretchScore?: number | null;
    analystUpsideScore?: number | null;
    growthSupportScore?: number | null;
    momentumPowerScore?: number | null;
    momentumStretchScore?: number | null;
    sixWeekSetupScore?: number | null;
  };
  animal?: ValuationAnimal;
  note?: string;
};

export type ValuationForwardPosition = {
  ticker: string;
  company?: string;
  entryDate?: string;
  entryPrice?: number | null;
  lastDate?: string;
  lastPrice?: number | null;
  currentReturnPct?: number | null;
  returnPct?: number | null;
  maxDrawdownPct?: number | null;
  daysHeld?: number | null;
  entryAnimal?: string;
  lastAnimal?: string;
};

export type ValuationForwardGroup = {
  key: string;
  label: string;
  kind: 'glass' | 'animal' | 'strategy' | string;
  openCount?: number;
  closedCount?: number;
  sampleSize?: number;
  open?: {
    count?: number;
    avgReturnPct?: number | null;
    medianReturnPct?: number | null;
    hitRatePct?: number | null;
  };
  closed?: {
    count?: number;
    avgReturnPct?: number | null;
    medianReturnPct?: number | null;
    hitRatePct?: number | null;
  };
  combined?: {
    count?: number;
    avgReturnPct?: number | null;
    medianReturnPct?: number | null;
    hitRatePct?: number | null;
  };
  openPositions?: ValuationForwardPosition[];
  recentClosed?: ValuationForwardPosition[];
};

export type ValuationForwardTest = {
  asOf?: string;
  updatedAt?: string;
  snapshotCount?: number;
  note?: string;
  groups?: ValuationForwardGroup[];
};

export type ValuationPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  scannerGeneratedAt?: string;
  tickerCount?: number;
  requestedTickerCount?: number;
  source?: string;
  defaultSort?: string;
  rows?: ValuationRow[];
  summary?: Record<string, unknown>;
  forwardTest?: ValuationForwardTest | null;
  note?: string;
  message?: string;
};

function valuationsObjectName() {
  return process.env.SCANNER_RESULTS_GCS_VALUATIONS_OBJECT || 'scanner/valuations_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<ValuationPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(valuationsObjectName()).download();
  return JSON.parse(content.toString('utf8')) as ValuationPayload;
}

async function loadFromFile(): Promise<ValuationPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_VALUATIONS_JSON_PATH',
    'valuations_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as ValuationPayload;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function loadScannerValuationsData(): Promise<ValuationPayload> {
  const local = await loadFromFile().catch(() => null);
  if (local) return local;

  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    // fall through
  }

  return {
    connected: false,
    message: 'Valuations have not been uploaded yet. Run the valuation refresh on your PC, then upload.',
    rows: [],
  };
}
