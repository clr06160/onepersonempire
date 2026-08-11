import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type ScannerNewsItem = {
  ticker: string;
  title: string;
  snippet?: string;
  publisher?: string;
  site?: string;
  url?: string;
  image?: string;
  publishedDate?: string;
  tags?: string[];
};

export type ScannerNewsPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  source?: string;
  maxAgeDays?: number;
  perTicker?: number;
  tickerCount?: number;
  requestedTickerCount?: number;
  itemCount?: number;
  byTicker?: Record<string, ScannerNewsItem[]>;
  feed?: ScannerNewsItem[];
  market?: ScannerNewsItem[];
  note?: string;
  message?: string;
};

function newsObjectName() {
  return process.env.SCANNER_RESULTS_GCS_NEWS_OBJECT || 'scanner/scanner_news.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<ScannerNewsPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(newsObjectName()).download();
  return JSON.parse(content.toString('utf8')) as ScannerNewsPayload;
}

async function loadFromFile(): Promise<ScannerNewsPayload | null> {
  const jsonPath = process.env.SCANNER_NEWS_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as ScannerNewsPayload;
}

export async function loadScannerNewsData(): Promise<ScannerNewsPayload> {
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
    feed: [],
    byTicker: {},
    market: [],
  };
}
