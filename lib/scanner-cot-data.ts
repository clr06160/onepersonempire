import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type CotSide = 'LONG' | 'SHORT' | 'FLAT';
export type CotTrajectory = 'improving' | 'worsening' | 'unchanged';

export type CotSleeveSides = {
  follow?: CotSide;
  fadeExtreme?: CotSide;
  adaptive?: CotSide;
};

export type CotMarketRow = {
  market: string;
  signal: string;
  stance?: CotSide;
  trajectory?: CotTrajectory | string;
  netTrend?: CotTrajectory | string;
  specNet: number;
  specNetChange: number;
  netPctOi?: number | null;
  changeTone?: string;
  extreme?: boolean;
  longSharePct?: number | null;
  shortSharePct?: number | null;
  sides?: CotSleeveSides;
};

export type CotChartPoint = {
  date: string;
  long: number;
  short: number;
  net: number;
};

export type CotChartMarket = {
  id: string;
  label: string;
  group: string;
  trader: string;
  contract?: string;
  signal: string;
  stance?: CotSide;
  trajectory?: CotTrajectory | string;
  netTrend?: CotTrajectory | string;
  specNet: number;
  specNetChange: number;
  netPctOi?: number | null;
  changeTone?: string;
  extreme?: boolean;
  longSharePct?: number | null;
  shortSharePct?: number | null;
  sides?: CotSleeveSides;
  longTrend?: string;
  shortTrend?: string;
  weeks?: number;
  series: CotChartPoint[];
};

export type CotForwardPeriodSummary = {
  periodCount?: number;
  avgPeriodReturnPct?: number | null;
  totalReturnPct?: number | null;
  hitRatePct?: number | null;
};

export type CotForwardMonth = {
  month: string;
  weekCount?: number;
  returnPct?: number | null;
  avgWeekReturnPct?: number | null;
  hitRatePct?: number | null;
};

export type CotForwardPeriod = {
  from?: string;
  to?: string;
  entryDate?: string;
  exitDate?: string;
  returnPct?: number | null;
  marketCount?: number;
  activeCount?: number;
};

export type CotForwardOpenPosition = {
  marketId?: string;
  etf?: string;
  side?: CotSide;
  reportDate?: string;
  entryDate?: string;
  asOf?: string;
  openReturnPct?: number | null;
};

export type CotForwardSleeve = {
  key: string;
  label: string;
  summary?: CotForwardPeriodSummary;
  weeklySummary?: CotForwardPeriodSummary;
  monthlySummary?: CotForwardPeriodSummary;
  monthly?: CotForwardMonth[];
  recentPeriods?: CotForwardPeriod[];
  openAvgReturnPct?: number | null;
  openPositions?: CotForwardOpenPosition[];
  lastReportDate?: string | null;
};

export type CotForwardMarket = {
  id: string;
  label?: string;
  etf?: string;
  stance?: CotSide;
  trajectory?: CotTrajectory | string;
  netTrend?: CotTrajectory | string;
  extreme?: boolean;
  longSharePct?: number | null;
  shortSharePct?: number | null;
  netPctOi?: number | null;
  sides?: CotSleeveSides;
};

export type CotForwardTest = {
  asOf?: string;
  reportDate?: string | null;
  updatedAt?: string;
  method?: string;
  sleeves?: CotForwardSleeve[];
  markets?: CotForwardMarket[];
  error?: string;
};

export type CotReportPayload = {
  connected?: boolean;
  generatedAt?: string;
  reportDate?: string;
  historyMonths?: number;
  forwardHistoryMonths?: number;
  equitiesOverall?: {
    signal: string;
    stance?: CotSide;
    trajectory?: CotTrajectory | string;
    netTrend?: CotTrajectory | string;
    weightedNet: number;
    netChange: number;
    changeTone?: string;
    extreme?: boolean;
    longSharePct?: number | null;
    shortSharePct?: number | null;
    sides?: CotSleeveSides;
  } | null;
  equities?: CotMarketRow[];
  commodities?: {
    energy?: CotMarketRow[];
    metals?: CotMarketRow[];
  };
  charts?: CotChartMarket[];
  forwardTest?: CotForwardTest | null;
  note?: string;
  discoveryStatus?: string;
  message?: string;
};

function cotObjectName() {
  return process.env.SCANNER_RESULTS_GCS_COT_OBJECT || 'scanner/cot_report_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<CotReportPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(cotObjectName()).download();
  return JSON.parse(content.toString('utf8')) as CotReportPayload;
}

async function loadFromFile(): Promise<CotReportPayload | null> {
  const jsonPath = process.env.SCANNER_COT_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as CotReportPayload;
}

export async function loadCotReportData(): Promise<CotReportPayload> {
  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    const file = await loadFromFile().catch(() => null);
    if (file) return file;
  }
  const file = await loadFromFile().catch(() => null);
  if (file) return file;
  return {
    connected: false,
    message: 'COT report not uploaded yet. Run scanners/cot_report_dashboard.py on your PC, then upload.',
    equities: [],
    charts: [],
  };
}
