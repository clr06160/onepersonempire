import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type CupHandleUniverse = {
  key: string;
  label: string;
  benchmark: string;
  covered: number;
  setups: number;
  trades: number;
  winRatePct?: number | null;
  avgReturnPct?: number | null;
  medianReturnPct?: number | null;
  avgWinPct?: number | null;
  avgLossPct?: number | null;
  profitFactor?: number | null;
  avgDaysHeld?: number | null;
  bestPct?: number | null;
  worstPct?: number | null;
  strategyCagrPct?: number | null;
  strategyTotalPct?: number | null;
  strategyMaxDdPct?: number | null;
  benchCagrPct?: number | null;
  benchTotalPct?: number | null;
  exitReasons?: Record<string, number>;
};

export type CupHandleBreakout = {
  ticker: string;
  universe: string;
  universeKey: string;
  breakoutDate: string;
  pivot?: number | null;
  breakoutClose?: number | null;
  lastClose?: number | null;
  pctFromPivot?: number | null;
  volRatio?: number | null;
  cupDays?: number | null;
  handleDays?: number | null;
  cupDepthPct?: number | null;
  handleDepthPct?: number | null;
  rsVsBenchPct?: number | null;
  daysSinceBreakout?: number | null;
  actionable?: boolean;
};

export type CupHandlePayload = {
  connected?: boolean;
  generatedAt?: string;
  windowStart?: string;
  years?: number;
  methodology?: string[];
  universes?: CupHandleUniverse[];
  recentBreakouts?: CupHandleBreakout[];
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_CUP_HANDLE_OBJECT || 'scanner/cup_handle_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<CupHandlePayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as CupHandlePayload;
}

async function loadFromFile(): Promise<CupHandlePayload | null> {
  const jsonPath = process.env.SCANNER_CUP_HANDLE_JSON_PATH;
  if (jsonPath) {
    const raw = await readFile(jsonPath, 'utf8');
    return JSON.parse(raw) as CupHandlePayload;
  }

  if (process.env.NODE_ENV === 'development') {
    const localPath = `${process.cwd()}/../Projects/stocks/scanners/cup_handle_dashboard.json`;
    try {
      const raw = await readFile(localPath, 'utf8');
      return JSON.parse(raw) as CupHandlePayload;
    } catch {
      return null;
    }
  }
  return null;
}

export async function loadCupHandleData(): Promise<CupHandlePayload> {
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
    message: 'Data is refreshing. Check back shortly.',
    universes: [],
    recentBreakouts: [],
  };
}
