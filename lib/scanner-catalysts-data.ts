import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type CatalystNewsItem = {
  ticker?: string;
  title?: string;
  snippet?: string;
  publisher?: string;
  site?: string;
  url?: string;
  publishedDate?: string;
  tags?: string[];
};

export type CatalystValuationSummary = {
  runwayScore?: number | null;
  musicStopsRisk?: number | null;
  sixWeekSetupScore?: number | null;
  animal?: string | null;
  note?: string;
};

export type CatalystNextEarnings = {
  earningsDate?: string;
  weekday?: string;
  threeDayReactionPct?: number | null;
  immediateReactionPct?: number | null;
};

export type CatalystNextLayerClue = {
  fromLayer?: string;
  toLayer?: string;
  toLabel?: string;
  direction?: string;
  stage?: string;
  tickerCount?: number;
  tickers?: string[];
  note?: string;
};

export type CatalystThemeParent = {
  parent: string;
  themeCount?: number;
  tickerCount?: number;
  confirmedCount?: number;
  themes?: CatalystThemeSummary[];
};

export type CatalystThemeHit = {
  key: string;
  label: string;
  parent?: string;
  buildoutLayer?: string;
  reasons?: string[];
};

export type CatalystPrice = {
  price?: number | null;
  priceDate?: string | null;
  distanceFrom20dPct?: number | null;
  distanceFrom50dPct?: number | null;
  return1wPct?: number | null;
  return1mPct?: number | null;
  return3mPct?: number | null;
  volumeRatio20d?: number | null;
};

export type CatalystRow = {
  rank?: number;
  ticker: string;
  company?: string;
  sector?: string;
  industry?: string;
  systems?: string[];
  price?: CatalystPrice;
  valuation?: CatalystValuationSummary;
  nextEarnings?: CatalystNextEarnings | null;
  catalystType?: string;
  evidenceGrade?: string;
  marketConfirmation?: string;
  actionLens?: string;
  themes?: CatalystThemeHit[];
  tags?: string[];
  headlineCount?: number;
  latestHeadline?: CatalystNewsItem | null;
  headlines?: CatalystNewsItem[];
  evidenceScore?: number;
};

export type CatalystThemeSummary = {
  key: string;
  parent?: string;
  label: string;
  buildoutLayer?: string;
  direction?: string;
  stage?: string;
  tickerCount?: number;
  confirmedCount?: number;
  tickers?: string[];
  watchlistOnly?: boolean;
  leaders?: {
    ticker: string;
    company?: string;
    return1mPct?: number | null;
    confirmation?: string;
    source?: string;
  }[];
};

export type CatalystBuildoutLayer = {
  key?: string;
  label: string;
  buildoutLayer: string;
  direction?: string;
  stage?: string;
  scannerTickerCount?: number;
  watchlistTickerCount?: number;
  tickerCount?: number;
  tickers?: string[];
  watchlistTickers?: string[];
  evidenceNote?: string;
  leaders?: {
    ticker: string;
    return1mPct?: number | null;
    confirmation?: string;
    source?: string;
  }[];
};

export type CatalystEmergingPhrase = {
  phrase: string;
  tickerCount?: number;
  tickers?: string[];
  example?: string;
  status?: string;
};

export type CatalystForwardPosition = {
  ticker: string;
  company?: string;
  entryDate?: string;
  entryPrice?: number | null;
  lastDate?: string;
  lastPrice?: number | null;
  currentReturnPct?: number | null;
  returnPct?: number | null;
  entryConfirmation?: string;
};

export type CatalystForwardGroup = {
  key: string;
  label: string;
  kind?: string;
  openCount?: number;
  closedCount?: number;
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
    outcomeBuckets?: Record<string, { count?: number; avgReturnPct?: number | null; hitRatePct?: number | null }>;
  };
  openPositions?: CatalystForwardPosition[];
  recentClosed?: CatalystForwardPosition[];
};

export type CatalystPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  scannerGeneratedAt?: string;
  source?: string;
  tickerCount?: number;
  requestedTickerCount?: number;
  themeCount?: number;
  runningNowCount?: number;
  defaultSort?: string;
  themes?: CatalystThemeSummary[];
  themeParents?: CatalystThemeParent[];
  buildoutLayers?: CatalystBuildoutLayer[];
  nextLayerClues?: CatalystNextLayerClue[];
  rows?: CatalystRow[];
  runningNow?: CatalystRow[];
  catchingOn?: CatalystThemeSummary[];
  emergingPhrases?: CatalystEmergingPhrase[];
  needsReview?: CatalystEmergingPhrase[];
  forwardTest?: {
    asOf?: string;
    updatedAt?: string;
    note?: string;
    groups?: CatalystForwardGroup[];
  };
  news?: {
    generatedAt?: string;
    itemCount?: number;
    maxAgeDays?: number;
    feed?: CatalystNewsItem[];
  };
  note?: string;
  message?: string;
};

function catalystsObjectName() {
  return process.env.SCANNER_RESULTS_GCS_CATALYSTS_OBJECT || 'scanner/catalysts_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<CatalystPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(catalystsObjectName()).download();
  return JSON.parse(content.toString('utf8')) as CatalystPayload;
}

async function loadFromFile(): Promise<CatalystPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_CATALYSTS_JSON_PATH',
    'catalysts_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as CatalystPayload;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function loadScannerCatalystsData(): Promise<CatalystPayload> {
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
    message: 'Catalysts have not been uploaded yet. Run the catalyst refresh on your PC, then upload.',
    rows: [],
    themes: [],
    emergingPhrases: [],
  };
}
