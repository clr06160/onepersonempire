import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type Top100Row = {
  rank: number;
  ticker: string;
  company?: string;
  latest?: number | null;
  weightedAlpha?: number | null;
  ytd?: number | null;
  pct5d?: number | null;
  pct1m?: number | null;
  pct3m?: number | null;
  pct52w?: number | null;
  pct2y?: number | null;
  pct3y?: number | null;
  pct5y?: number | null;
  pct10y?: number | null;
};

export type Top100UniverseDataset = {
  label?: string;
  tickerCount?: number;
  rows?: Top100Row[];
};

export type Top100Payload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  topN?: number;
  defaultUniverse?: string;
  defaultSort?: string;
  universe?: string;
  universeLabel?: string;
  tickerCount?: number;
  universeOptions?: Array<{ key: string; label: string }>;
  sortOptions?: Array<{ key: string; label: string; ascending?: boolean }>;
  universes?: Record<string, Top100UniverseDataset>;
  rows?: Top100Row[];
  note?: string;
  message?: string;
};

function top100ObjectName() {
  return process.env.SCANNER_RESULTS_GCS_TOP100_OBJECT || 'scanner/top100_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<Top100Payload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(top100ObjectName()).download();
  return JSON.parse(content.toString('utf8')) as Top100Payload;
}

async function loadFromFile(): Promise<Top100Payload | null> {
  const jsonPath = process.env.SCANNER_TOP100_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as Top100Payload;
}

export async function loadTop100Data(): Promise<Top100Payload> {
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
    message: 'Top 100 leaderboard not uploaded yet. Run the daily scanner refresh on your PC, then upload.',
    rows: [],
  };
}
