import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type MonitorInsight = {
  fingerprint?: string;
  category?: string;
  title?: string;
  body?: string;
  severity?: string;
  source?: string;
  actionable?: string;
  confidence?: number;
  seenCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  status?: string;
};

export type AdaptiveMonitorPayload = {
  connected?: boolean;
  generatedAt?: string;
  cycleCount?: number;
  lastCycleAt?: string;
  startedAt?: string;
  operator?: {
    verdict?: string;
    headline?: string;
    healthVerdict?: string;
    recommendations?: string[];
  };
  insights?: {
    active?: MonitorInsight[];
    fading?: MonitorInsight[];
    byCategory?: Record<string, MonitorInsight[]>;
  };
  learningLog?: Array<{
    at?: string;
    summary?: string;
    cycle?: number;
    newInsights?: number;
    reinforced?: number;
  }>;
  sources?: Record<string, string | boolean | null | undefined>;
  loop?: Record<string, unknown>;
  healthSnapshot?: Record<string, unknown>;
  researchSnapshot?: Record<string, unknown>;
  message?: string;
};

function monitorObjectName() {
  return process.env.SCANNER_RESULTS_GCS_MONITOR_OBJECT || 'scanner/adaptive_monitor_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<AdaptiveMonitorPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(monitorObjectName()).download();
  return JSON.parse(content.toString('utf8')) as AdaptiveMonitorPayload;
}

async function loadFromFile(): Promise<AdaptiveMonitorPayload | null> {
  const jsonPath = process.env.SCANNER_MONITOR_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as AdaptiveMonitorPayload;
}

export async function loadAdaptiveMonitorData(): Promise<AdaptiveMonitorPayload> {
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
    message:
      'Adaptive monitor not uploaded yet. It runs automatically during the daily 7:35 AM scanner refresh on your PC.',
    insights: { active: [], byCategory: {} },
    learningLog: [],
  };
}
