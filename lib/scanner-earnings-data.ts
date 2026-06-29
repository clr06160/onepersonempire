import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type EarningsCalendarStock = {
  ticker: string;
  company?: string;
  sector?: string;
  earningsDate: string;
  time?: string;
  timeLabel?: string;
  epsEstimated?: number | null;
  revenueEstimated?: number | null;
  earningsReactionScore?: number | null;
  immediateReactionPct?: number | null;
  threeDayReactionPct?: number | null;
  lastEarningsDate?: string | null;
  universes?: string[];
};

export type EarningsCalendarDay = {
  date: string;
  weekday?: string;
  count?: number;
  stocks: EarningsCalendarStock[];
};

export type EarningsCalendarPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  metric?: string;
  threshold?: number;
  lookaheadDays?: number;
  windowEnd?: string;
  criteria?: string;
  totalCount?: number;
  qualifierCount?: number;
  days?: EarningsCalendarDay[];
  note?: string;
  message?: string;
};

function earningsObjectName() {
  return process.env.SCANNER_RESULTS_GCS_EARNINGS_OBJECT || 'scanner/earnings_calendar.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<EarningsCalendarPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(earningsObjectName()).download();
  return JSON.parse(content.toString('utf8')) as EarningsCalendarPayload;
}

async function loadFromFile(): Promise<EarningsCalendarPayload | null> {
  const jsonPath = process.env.SCANNER_EARNINGS_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as EarningsCalendarPayload;
}

export async function loadEarningsCalendarData(): Promise<EarningsCalendarPayload> {
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
    message: 'Earnings calendar not uploaded yet. Run the daily fundamentals refresh on your PC, then upload.',
    days: [],
  };
}
