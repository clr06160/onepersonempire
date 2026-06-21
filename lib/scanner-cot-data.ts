import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';



export type CotMarketRow = {

  market: string;

  signal: string;

  specNet: number;

  specNetChange: number;

  netPctOi?: number | null;

  changeTone?: string;

  extreme?: boolean;

};



export type CotReportPayload = {

  connected?: boolean;

  generatedAt?: string;

  reportDate?: string;

  equitiesOverall?: {

    signal: string;

    weightedNet: number;

    netChange: number;

    changeTone?: string;

  } | null;

  equities?: CotMarketRow[];

  commodities?: {

    energy?: CotMarketRow[];

    metals?: CotMarketRow[];

  };

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

  };

}

