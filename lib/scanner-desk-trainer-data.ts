import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';

export type DeskTrainerHolding = {
  ticker: string;
  weightPct?: number;
  entryPrice?: number;
  markPrice?: number;
  openReturnPct?: number;
};

export type DeskTrainerSleeve = {
  id: string;
  label: string;
  blurb?: string;
  top?: string[];
  sessionReturnPct?: number | null;
};

export type DeskTrainerAdvisor = {
  action?: string;
  summary?: string;
  reasons?: string[];
  cuts?: string[];
  adds?: string[];
  targetHoldings?: string[];
  exposureCapPct?: number;
  followedSleeveId?: string;
};

export type DeskTrainerClimate = {
  label?: string;
  bucket?: string;
  metric?: string;
  sleeveId?: string;
  reason?: string;
};

export type DeskTrainerStyle = {
  id: string;
  label: string;
  habit?: 'good' | 'risk' | string;
  summary?: string;
};

export type DeskTrainerNewsItem = {
  headline: string;
  tone?: 'panic' | 'fear' | 'neutral' | 'relief' | string;
  tag?: string;
};

export type DeskTrainerDay = {
  dayIndex: number;
  label: string;
  sleeves?: DeskTrainerSleeve[];
  climate?: DeskTrainerClimate;
  portfolio?: {
    equity?: number;
    qqqEquity?: number;
    drawdownPct?: number;
    edgeVsQqqPct?: number;
    exposurePct?: number;
    followedSleeveId?: string;
    holdings?: DeskTrainerHolding[];
  };
  advisor?: DeskTrainerAdvisor;
  marks?: Record<string, number>;
  outcome?: {
    nextLabel?: string;
    nextMarks?: Record<string, number>;
  };
  pressure?: {
    dip?: boolean;
    panicRisk?: boolean;
    boredomRisk?: boolean;
  };
  /** Index day return vs prior session day (pack may omit; UI can derive). */
  indexDayRetPct?: number | null;
  /** Sensational wire headlines for emotional pressure (may be synthetic). */
  news?: DeskTrainerNewsItem[];
};

export type DeskTrainerSession = {
  id: string;
  eraMask?: string;
  days?: DeskTrainerDay[];
  meta?: {
    dayCount?: number;
    rosterN?: number;
    rules?: string[];
  };
};

export type DeskTrainerPack = {
  connected?: boolean;
  generatedAt?: string;
  title?: string;
  subtitle?: string;
  howto?: string[];
  rules?: string[];
  styles?: DeskTrainerStyle[];
  sessions?: DeskTrainerSession[];
  sessionCount?: number;
  message?: string;
  source?: string;
};

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function objectName() {
  return process.env.SCANNER_DESK_TRAINER_GCS_OBJECT || 'scanner/desk_trainer_pack.json';
}

async function loadFromGcs(): Promise<DeskTrainerPack | null> {
  const bucket = bucketName();
  if (!bucket) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(bucket).file(objectName()).download();
  return { ...(JSON.parse(content.toString('utf8')) as DeskTrainerPack), source: 'gcs' };
}

async function loadFromFile(): Promise<DeskTrainerPack | null> {
  for (const jsonPath of resolveScannerJsonCandidates('SCANNER_DESK_TRAINER_JSON_PATH', 'desk_trainer_pack.json')) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return { ...(JSON.parse(raw) as DeskTrainerPack), source: 'file' };
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadDeskTrainerPack(): Promise<DeskTrainerPack> {
  const local = await loadFromFile();
  if (local) return local;
  try {
    const cloud = await loadFromGcs();
    if (cloud) return cloud;
  } catch {
    // fall through
  }
  return {
    connected: false,
    sessions: [],
    message: 'Desk Trainer pack not built yet. Run python scanners/build_desk_trainer_pack.py --upload.',
  };
}
