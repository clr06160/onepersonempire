import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

export type ElliottWaveTarget = {
  label: string;
  price: number;
  kind: 'high' | 'low' | 'correction' | 'support' | 'deep';
};

export type ElliottWaveMarker = {
  date: string;
  price: number;
  label: string;
  kind: 'high' | 'low';
  tier?: 'major' | 'sub';
};

export type ElliottWaveChart = {
  bars?: { date: string; close: number; high: number; low: number }[];
  markers?: ElliottWaveMarker[];
  zigzag?: { date: string; price: number }[];
  timeframe?: string;
  targetLines?: ElliottWaveTarget[];
  svg?: string;
};

export type ElliottWaveProbabilities = {
  probHighFirst?: number | null;
  probLowFirst?: number | null;
  likelyFirst?: 'high' | 'low' | 'split' | null;
  confidence?: 'low' | 'medium' | 'high';
  drivers?: string[];
};

export type ElliottWaveSourceConsensus = {
  highFirstVotes?: number;
  lowFirstVotes?: number;
  neutralVotes?: number;
  agreement?: string;
  lean?: string;
  summary?: string;
  votes?: { vote: string; source: string; weight?: string }[];
};

export type ElliottWaveWaveStep = {
  id?: string;
  wave?: string;
  point?: string;
  price?: number;
  label?: string;
  hint?: string;
  status?: 'past' | 'here' | 'next' | 'ahead';
};

export type ElliottWaveRoadmap = {
  mode?: 'correction_abc' | 'impulse_12345';
  modeLabel?: string;
  modeNote?: string;
  currentWave?: string;
  steps?: ElliottWaveWaveStep[];
};

export type ElliottWaveQuote = {
  label?: string;
  rawLabel?: string;
  phase?: string;
  direction?: 'up' | 'down' | 'neutral';
  targets?: ElliottWaveTarget[];
  waveHigh?: number | null;
  waveLow?: number | null;
  primaryHigh?: number | null;
  primaryLow?: number | null;
  primaryHighLabel?: string | null;
  primaryLowLabel?: string | null;
  supportLow?: number | null;
  supportLowLabel?: string | null;
  deepSupportLow?: number | null;
  deepSupportLowLabel?: string | null;
  waveRoadmap?: ElliottWaveRoadmap | null;
  chart?: ElliottWaveChart;
};

export type ElliottWaveTurn = {
  bias?: string;
  tone?: string;
  headline?: string;
};

export type ElliottWaveSparkPoint = {
  date: string;
  close: number;
};

export type ElliottWaveResearcher = {
  id?: string;
  name?: string;
  xHandle?: string;
  xUrl?: string;
  site?: string;
  tier?: string;
  cadence?: string;
  notes?: string;
};

export type ElliottWaveExternalPost = {
  label?: string;
  url: string;
  source?: string;
  researcher?: string;
  handle?: string;
  publishedAt?: string;
  pinned?: boolean;
  targetBias?: string;
  stanceNote?: string;
};

export type ElliottWaveMarket = {
  ticker: string;
  label: string;
  group: string;
  role: string;
  asOf?: string;
  priceSource?: string;
  price?: {
    close: number;
    change1dPct: number;
    above50Ma?: boolean | null;
    above200Ma?: boolean | null;
  };
  elliott?: ElliottWaveQuote;
  turn?: ElliottWaveTurn;
  sparkline?: ElliottWaveSparkPoint[];
  interpretation?: string;
  tradingViewUrl?: string;
  externalLinks?: { label: string; url: string }[];
  ewResearchers?: ElliottWaveResearcher[];
  recentEwPosts?: ElliottWaveExternalPost[];
  ewFeedAt?: string;
  probabilities?: ElliottWaveProbabilities;
  sourceConsensus?: ElliottWaveSourceConsensus;
  priceProxy?: string;
  proxyNote?: string;
  error?: string;
};

export type ElliottWavePayload = {
  connected?: boolean;
  generatedAt?: string;
  asOf?: string;
  ewGuide?: {
    url?: string;
    title?: string;
    engineRules?: string[];
  };
  method?: string[];
  playbook?: string[];
  overall?: {
    verdict?: string;
    tone?: string;
    detail?: string;
    goldNote?: string;
    equityScore?: number;
  };
  markets?: ElliottWaveMarket[];
  externalNote?: string;
  ewFeedAt?: string;
  ewSourcesAt?: string;
  note?: string;
  message?: string;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_EW_DASHBOARD_OBJECT || 'scanner/elliott_wave_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<ElliottWavePayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as ElliottWavePayload;
}

async function loadFromFile(): Promise<ElliottWavePayload | null> {
  const jsonPath = process.env.SCANNER_EW_DASHBOARD_JSON_PATH;
  if (!jsonPath) return null;
  const raw = await readFile(jsonPath, 'utf8');
  return JSON.parse(raw) as ElliottWavePayload;
}

export async function loadElliottWaveDashboard(): Promise<ElliottWavePayload> {
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
      'Elliott Wave dashboard not uploaded yet. Run python scanners/elliott_wave_dashboard.py --upload on the PC.',
    markets: [],
  };
}
