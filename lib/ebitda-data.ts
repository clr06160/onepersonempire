import { readFile } from 'fs/promises';
import path from 'path';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import type {
  EbitdaForwardTest,
  EbitdaForwardUniverse,
  EbitdaName,
  EbitdaPayload,
  EbitdaQuarter,
} from '@/lib/ebitda-shared';

export type { EbitdaName, EbitdaPayload, EbitdaQuarter, EbitdaForwardTest } from '@/lib/ebitda-shared';
export { filterEbitdaNames } from '@/lib/ebitda-shared';

function normalizeName(raw: unknown): EbitdaName | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const ticker = typeof row.ticker === 'string' ? row.ticker.trim().toUpperCase() : '';
  if (!ticker) return null;

  const quarters = Array.isArray(row.quarters)
    ? row.quarters
        .map((quarter) => {
          if (!quarter || typeof quarter !== 'object') return null;
          const q = quarter as Record<string, unknown>;
          const period = typeof q.period === 'string' ? q.period : '';
          const ebitdaMargin = Number(q.ebitdaMargin);
          if (!period || !Number.isFinite(ebitdaMargin)) return null;
          const revenueM = Number(q.revenueM);
          return {
            period,
            ebitdaMargin,
            ...(Number.isFinite(revenueM) ? { revenueM } : {}),
          } satisfies EbitdaQuarter;
        })
        .filter((quarter): quarter is EbitdaQuarter => Boolean(quarter))
    : [];

  const ebitdaMarginLatest = Number(row.ebitdaMarginLatest);
  const ebitdaMarginPrior = Number(row.ebitdaMarginPrior);
  const marginDeltaPp = Number(
    row.marginDeltaPp ??
      (Number.isFinite(ebitdaMarginLatest) && Number.isFinite(ebitdaMarginPrior)
        ? ebitdaMarginLatest - ebitdaMarginPrior
        : NaN),
  );

  if (!Number.isFinite(ebitdaMarginLatest) || !Number.isFinite(ebitdaMarginPrior) || !Number.isFinite(marginDeltaPp)) {
    return null;
  }

  const revenueGrowthYoY =
    row.revenueGrowthYoY === null || row.revenueGrowthYoY === undefined
      ? null
      : Number(row.revenueGrowthYoY);
  const above200dma =
    typeof row.above200dma === 'boolean' ? row.above200dma : row.above200dma == null ? null : Boolean(row.above200dma);

  const universes = Array.isArray(row.universes)
    ? row.universes.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : undefined;

  return {
    ticker,
    name: typeof row.name === 'string' ? row.name : ticker,
    sector: typeof row.sector === 'string' ? row.sector : undefined,
    ...(universes?.length ? { universes } : {}),
    ebitdaMarginLatest,
    ebitdaMarginPrior,
    marginDeltaPp,
    revenueGrowthYoY: revenueGrowthYoY !== null && Number.isFinite(revenueGrowthYoY) ? revenueGrowthYoY : null,
    above200dma,
    asOf: typeof row.asOf === 'string' ? row.asOf : undefined,
    why: typeof row.why === 'string' ? row.why : undefined,
    quarters,
  };
}

function normalizeForwardUniverse(raw: unknown): EbitdaForwardUniverse | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const key = typeof row.key === 'string' ? row.key : '';
  const label = typeof row.label === 'string' ? row.label : key;
  if (!key) return null;
  return {
    ...(row as EbitdaForwardUniverse),
    key,
    label,
  };
}

function normalizeForwardTest(raw: unknown): EbitdaForwardTest | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const universes = Array.isArray(row.universes)
    ? row.universes.map(normalizeForwardUniverse).filter((item): item is EbitdaForwardUniverse => Boolean(item))
    : [];
  return {
    asOf: typeof row.asOf === 'string' ? row.asOf : undefined,
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : undefined,
    method: typeof row.method === 'string' ? row.method : undefined,
    topN: Number.isFinite(Number(row.topN)) ? Number(row.topN) : 10,
    note: typeof row.note === 'string' ? row.note : undefined,
    universes,
  };
}

function normalizePayload(parsed: unknown, source: string): EbitdaPayload {
  if (!parsed || typeof parsed !== 'object') {
    return { connected: false, message: 'EBITDA margin data was empty.', names: [], source };
  }

  const raw = parsed as Record<string, unknown>;
  const names = Array.isArray(raw.names)
    ? raw.names.map(normalizeName).filter((name): name is EbitdaName => Boolean(name))
    : [];

  names.sort((a, b) => b.marginDeltaPp - a.marginDeltaPp);

  return {
    connected: names.length > 0,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : undefined,
    universe: typeof raw.universe === 'string' ? raw.universe : undefined,
    note: typeof raw.note === 'string' ? raw.note : undefined,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    method: Array.isArray(raw.method) ? raw.method.filter((item): item is string => typeof item === 'string') : [],
    names,
    forwardTest: normalizeForwardTest(raw.forwardTest),
    source,
  };
}

function ebitdaBucketName() {
  return process.env.EBITDA_MARGINS_GCS_BUCKET || process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function ebitdaObjectName() {
  return process.env.EBITDA_MARGINS_GCS_OBJECT || 'scanner/ebitda_margin_trends.json';
}

async function loadFromGcs(): Promise<EbitdaPayload | null> {
  const bucketName = ebitdaBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(bucketName).file(ebitdaObjectName()).download();
  return normalizePayload(JSON.parse(content.toString('utf8')), 'gcs');
}

async function loadFromFile(): Promise<EbitdaPayload | null> {
  const configured = process.env.EBITDA_MARGINS_JSON_PATH;
  const fallback = path.join(process.cwd(), 'data', 'ebitda-margin-trends.json');
  const jsonPath = configured || fallback;

  try {
    const raw = await readFile(jsonPath, 'utf8');
    return normalizePayload(JSON.parse(raw), configured ? 'file' : 'sample-file');
  } catch (error) {
    if (configured) throw error;
    return null;
  }
}

export async function loadEbitdaMarginData(): Promise<EbitdaPayload> {
  try {
    const cloudData = await loadFromGcs();
    if (cloudData?.names.length) return cloudData;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load EBITDA margin data from cloud storage.';
    const fileData = await loadFromFile().catch(() => null);
    if (fileData?.names.length) {
      return { ...fileData, message: fileData.note || message };
    }
    return { connected: false, message, names: [] };
  }

  const fileData = await loadFromFile();
  if (fileData?.names.length) return fileData;

  return {
    connected: false,
    message:
      'No EBITDA margin trend file yet. Upload scanner/ebitda_margin_trends.json to the results bucket, or set EBITDA_MARGINS_JSON_PATH.',
    names: [],
  };
}
