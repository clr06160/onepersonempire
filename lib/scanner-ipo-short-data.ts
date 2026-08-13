import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type IpoShortHorizon = {
  label?: string;
  trades?: number;
  winRatePct?: number | null;
  avgPct?: number | null;
  medianPct?: number | null;
  avgWinPct?: number | null;
  avgLossPct?: number | null;
  worstPct?: number | null;
  p10Pct?: number | null;
  p90Pct?: number | null;
};

export type IpoShortYearRow = {
  year?: string;
  count?: number;
  winRatePct?: number | null;
  avgPct?: number | null;
  medianPct?: number | null;
};

export type IpoShortStopRow = {
  stopPct?: number | null;
  label?: string;
  avgPct?: number | null;
  medianPct?: number | null;
  worstPct?: number | null;
  winRatePct?: number | null;
  stops?: number | null;
  note?: string;
};

export type IpoShortRule = {
  tone?: 'danger' | 'warning' | 'info' | string;
  title?: string;
  body?: string;
};

export type IpoShortPayload = {
  connected?: boolean;
  generatedAt?: string;
  title?: string;
  subtitle?: string;
  window?: { start?: string; end?: string };
  universe?: {
    source?: string;
    filter?: string;
    candidates?: number;
    trades3m?: number;
    trades6m?: number;
  };
  method?: string[];
  operatingRules?: IpoShortRule[];
  headline?: {
    hold3m?: IpoShortHorizon;
    hold6m?: IpoShortHorizon;
  };
  byYear6m?: IpoShortYearRow[];
  stopSweep6m?: IpoShortStopRow[];
  bottomLine?: string[];
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_IPO_SHORT_OBJECT || 'scanner/ipo_short_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<IpoShortPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as IpoShortPayload;
}

async function loadFromFile(): Promise<IpoShortPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_IPO_SHORT_JSON_PATH',
    'ipo_short_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as IpoShortPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadIpoShortDashboard(): Promise<IpoShortPayload> {
  const local = await loadFromFile().catch(() => null);
  if (local) return local;

  try {
    const remote = await loadFromGcs();
    if (remote) return remote;
  } catch {
    // fall through
  }

  return {
    connected: false,
    message: 'Data is refreshing. Check back shortly.',
    headline: {},
    byYear6m: [],
    stopSweep6m: [],
    operatingRules: [],
    bottomLine: [],
  };
}
