import { readFile } from 'fs/promises';

import { getStorage } from 'firebase-admin/storage';

import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { resolveScannerJsonCandidates } from '@/lib/scanner-local-paths';
import { WAVE4_PLAYBOOK, WAVE4_PRIORS } from '@/lib/scanner-wave4-rules';
import { TOPS_BOTTOMS_RESEARCH, type TopsBottomsResearchPack } from '@/lib/scanner-tops-research';

export type TopsBottomsPatternStats = {
  count?: number;
  hit10Pct?: number | null;
  hit20Pct?: number | null;
  failReclaimPct?: number | null;
  medianFwd63Pct?: number | null;
  medianGaveUpPct?: number | null;
  medianBarsFromLastPivot?: number | null;
  within5Pct?: number | null;
  within10Pct?: number | null;
  within15Pct?: number | null;
  withLens2PlusPct?: number | null;
};

export type TopsBottomsCloseness = {
  medianGaveUpPct?: number | null;
  medianBarsFromLastPivot?: number | null;
  within5Pct?: number | null;
  within10Pct?: number | null;
  within15Pct?: number | null;
  count?: number;
  hit10Pct?: number | null;
  hit20Pct?: number | null;
  failReclaimPct?: number | null;
};

export type TopsBottomsStats = {
  eventCount?: number;
  topCount?: number;
  bottomCount?: number;
  doubleTopShareOfTopsPct?: number | null;
  tripleTopShareOfTopsPct?: number | null;
  doubleBottomShareOfBottomsPct?: number | null;
  tripleBottomShareOfBottomsPct?: number | null;
  byPattern?: Record<string, TopsBottomsPatternStats>;
  topsHit10StructureOnlyPct?: number | null;
  topsHit10WithLens2PlusPct?: number | null;
  bottomsHit10StructureOnlyPct?: number | null;
  bottomsHit10WithLens2PlusPct?: number | null;
  closeness?: {
    all?: TopsBottomsCloseness;
    deskFilter?: TopsBottomsCloseness;
    deskFilterEw?: TopsBottomsCloseness;
  };
  elliott?: {
    topsAlignedHit10Pct?: number | null;
    topsAlignedCount?: number;
    topsNotAlignedHit10Pct?: number | null;
    topsNotAlignedCount?: number;
    bottomsAlignedHit10Pct?: number | null;
    bottomsAlignedCount?: number;
    bottomsNotAlignedHit10Pct?: number | null;
    bottomsNotAlignedCount?: number;
    deskHit10Pct?: number | null;
    deskCount?: number;
    deskEwHit10Pct?: number | null;
    deskEwCount?: number;
    rule?: string;
  };
  exhaustion?: {
    topsWith2PlusHit10Pct?: number | null;
    topsWith2PlusCount?: number;
    topsAllHit10Pct?: number | null;
    topsAllCount?: number;
    deskHit10Pct?: number | null;
    deskCount?: number;
    deskExhHit10Pct?: number | null;
    deskExhCount?: number;
    deskExhEwHit10Pct?: number | null;
    deskExhEwCount?: number;
    rule?: string;
  };
};

export type TopsBottomsEvent = {
  ticker: string;
  universe?: string;
  pattern?: string;
  peakDates?: string[];
  troughDates?: string[];
  neckline?: number | null;
  confirmDate?: string;
  confirmClose?: number | null;
  depthPct?: number | null;
  barsPeakToConfirm?: number | null;
  barsTroughToConfirm?: number | null;
  barsFromLastPivot?: number | null;
  structureExtreme?: number | null;
  gaveUpPct?: number | null;
  closeToTurn?: boolean;
  within5Pct?: boolean;
  within10Pct?: boolean;
  within15Pct?: boolean;
  deskPass?: boolean;
  deskPassEw?: boolean;
  exhaustionPass?: boolean;
  ewLabel?: string | null;
  ewAligned?: boolean;
  lenses?: string[];
  lensCount?: number;
  failedReclaim21d?: boolean;
  fwd21Pct?: number | null;
  fwd63Pct?: number | null;
  extreme63Pct?: number | null;
  hit10?: boolean;
  hit20?: boolean;
  chartHref?: string;
};

export type TopsBottomsVerdict = {
  keeps?: string[];
  kills?: string[];
  notes?: string[];
};

export type TopsBottomsCaseStudy = {
  ticker: string;
  title?: string;
  chartHref?: string;
  asOf?: string;
  lastClose?: number | null;
  nowEwLabel?: string | null;
  nowEwTopZone?: boolean;
  nowEwBottomZone?: boolean;
  nowLensesTop?: string[];
  notes?: string[];
  snapshots?: Array<{
    date?: string;
    close?: number | null;
    high?: number | null;
    low?: number | null;
    ewLabel?: string | null;
    ewTopZone?: boolean;
    ewBottomZone?: boolean;
    lensesTop?: string[];
    lensesBottom?: string[];
  }>;
};

export type TopsBottomsPayload = {
  connected?: boolean;
  generatedAt?: string;
  title?: string;
  subtitle?: string;
  frozenRules?: Record<string, unknown>;
  framework?: string[];
  devUniverse?: { label?: string; tickerCount?: number; tickers?: string[]; note?: string };
  holdoutUniverse?: {
    label?: string;
    tickerCount?: number;
    tickers?: string[];
    randomSeed?: number;
    note?: string;
  };
  devStats?: TopsBottomsStats;
  holdoutStats?: TopsBottomsStats;
  verdict?: TopsBottomsVerdict;
  caseStudies?: TopsBottomsCaseStudy[];
  events?: TopsBottomsEvent[];
  method?: string[];
  message?: string;
  wave4Playbook?: typeof WAVE4_PLAYBOOK;
  wave4Priors?: typeof WAVE4_PRIORS;
  research?: TopsBottomsResearchPack;
};

function objectName() {
  return process.env.SCANNER_RESULTS_GCS_TOPS_BOTTOMS_OBJECT || 'scanner/tops_bottoms_dashboard.json';
}

function bucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

async function loadFromGcs(): Promise<TopsBottomsPayload | null> {
  const name = bucketName();
  if (!name) return null;
  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(name).file(objectName()).download();
  return JSON.parse(content.toString('utf8')) as TopsBottomsPayload;
}

async function loadFromFile(): Promise<TopsBottomsPayload | null> {
  for (const jsonPath of resolveScannerJsonCandidates(
    'SCANNER_TOPS_BOTTOMS_JSON_PATH',
    'tops_bottoms_dashboard.json',
  )) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return JSON.parse(raw) as TopsBottomsPayload;
    } catch {
      // try next
    }
  }
  return null;
}

export async function loadTopsBottomsData(): Promise<TopsBottomsPayload> {
  const attach = (payload: TopsBottomsPayload): TopsBottomsPayload => ({
    ...payload,
    connected: payload.connected !== false,
    wave4Playbook: WAVE4_PLAYBOOK,
    wave4Priors: WAVE4_PRIORS,
    research: TOPS_BOTTOMS_RESEARCH,
  });

  const local = await loadFromFile().catch(() => null);
  if (local) return attach(local);

  try {
    const remote = await loadFromGcs();
    if (remote) return attach(remote);
  } catch {
    // fall through
  }

  return {
    connected: false,
    message: 'Tops & bottoms study refreshing.',
    events: [],
    framework: [],
    method: [],
    wave4Playbook: WAVE4_PLAYBOOK,
    wave4Priors: WAVE4_PRIORS,
    research: TOPS_BOTTOMS_RESEARCH,
  };
}
