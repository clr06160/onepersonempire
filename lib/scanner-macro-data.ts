import { readFile } from 'fs/promises';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type MacroEvent = {
  date: string;
  name: string;
  category?: string;
  importance?: string;
  source?: string;
};

export type MacroCalendarDay = {
  date: string;
  weekday?: string;
  count?: number;
  events: MacroEvent[];
};

export type MacroCalendarPayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  lookaheadDays?: number;
  windowEnd?: string;
  totalCount?: number;
  days?: MacroCalendarDay[];
  note?: string;
  message?: string;
};

function macroObjectName() {
  return process.env.SCANNER_RESULTS_GCS_MACRO_OBJECT || 'scanner/macro_calendar.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<MacroCalendarPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(macroObjectName()).download();
  return JSON.parse(content.toString('utf8')) as MacroCalendarPayload;
}

async function loadFromFile(): Promise<MacroCalendarPayload | null> {
  const jsonPath = process.env.SCANNER_MACRO_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as MacroCalendarPayload;
}

export async function loadMacroCalendarData(): Promise<MacroCalendarPayload> {
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
    message: 'Macro calendar not uploaded yet. Run the daily refresh on your PC, then upload.',
    days: [],
  };
}
