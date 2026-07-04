import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type FlowChartPoint = {
  date: string;
  long: number;
  short: number;
  net: number;
};

export type FlowBias = 'call_heavy' | 'put_heavy' | 'neutral';
export type FlowTrendBias = 'accumulating' | 'distributing' | 'mixed';
export type FlowStrength = 'weak' | 'moderate' | 'strong';

export type FlowPublicSummary = {
  signal: string;
  options: { bias: FlowBias; strength: FlowStrength; available: boolean };
  institutional: { bias: FlowTrendBias; strength: FlowStrength; available: boolean };
  volume: { bias: FlowTrendBias; strength: FlowStrength; available: boolean };
};

export type FlowTickerPayload = {
  id: string;
  label: string;
  signal: string;
  options: {
    available: boolean;
    reason?: string;
    asOf?: string;
    putVolume?: number;
    callVolume?: number;
    volumeRatio?: number | null;
    putOI?: number;
    callOI?: number;
    oiRatio?: number | null;
    sentiment?: string;
  };
  institutional: {
    available: boolean;
    reason?: string;
    dateReported?: string;
    yearBuying?: number;
    yearSelling?: number;
    buyersCount?: number;
    sellersCount?: number;
    holdersCount?: number;
    quarterCount?: number;
    quarters?: FlowChartPoint[];
    signal?: string;
    note?: string;
  };
  volume: {
    available: boolean;
    reason?: string;
    sessions?: number;
    totalUpVolume?: number;
    totalDownVolume?: number;
    series?: FlowChartPoint[];
    signal?: string;
  };
  publicSummary: FlowPublicSummary;
};

export type FlowPayload = {
  connected?: boolean;
  generatedAt?: string;
  tickerCount?: number;
  requestedTickerCount?: number;
  missed?: string[];
  tickers?: Record<string, FlowTickerPayload>;
  note?: string;
  message?: string;
};

export type FlowViewerPayload = {
  ticker: string;
  connected: boolean;
  generatedAt?: string;
  publicSummary: FlowPublicSummary | null;
  message?: string;
};

function flowObjectName() {
  return process.env.SCANNER_RESULTS_GCS_FLOW_OBJECT || 'scanner/scanner_flow.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<FlowPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(flowObjectName()).download();
  return JSON.parse(content.toString('utf8')) as FlowPayload;
}

async function loadFromFile(): Promise<FlowPayload | null> {
  const jsonPath = process.env.SCANNER_FLOW_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as FlowPayload;
}

export async function loadScannerFlowData(): Promise<FlowPayload> {
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
    message: 'Flow data not uploaded yet. Run scanners/build_scanner_flow.py on your PC, then upload.',
    tickers: {},
  };
}

export async function loadFlowTicker(ticker: string): Promise<FlowTickerPayload | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return null;
  const payload = await loadScannerFlowData();
  return payload.tickers?.[symbol] ?? null;
}

export function toViewerFlowPayload(ticker: string, row: FlowTickerPayload | null): FlowViewerPayload {
  if (!row) {
    return {
      ticker,
      connected: false,
      publicSummary: null,
      message: `No flow data for ${ticker}.`,
    };
  }
  return {
    ticker,
    connected: true,
    publicSummary: row.publicSummary,
  };
}
