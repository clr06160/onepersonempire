import { readFile } from 'fs/promises';
import path from 'path';
import { getStorage } from 'firebase-admin/storage';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { normalizeAgentLeaderboard } from '@/lib/scanner-agent-leaderboard';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export { normalizeAgentLeaderboard } from '@/lib/scanner-agent-leaderboard';

export type AgentTrade = {
  date?: string;
  type?: string;
  added?: string[];
  removed?: string[];
  holdings?: string[];
  exposurePct?: number;
  previousExposurePct?: number;
  reason?: string;
};

export type AgentEquityPoint = {
  date: string;
  equity: number;
  exposurePct?: number;
};

export type AgentLeaderboardRow = {
  rank?: number;
  agentId: string;
  systemId: string;
  label: string;
  role?: string;
  totalReturnPct: number;
  maxDrawdownPct: number;
  equity: number;
  daysLive: number;
  exposurePct: number;
  holdingsCount?: number;
  backtestCagr?: string;
  backtestMaxDd?: string;
  isHoldVariant?: boolean;
  usesLedgerHoldings?: boolean;
  holdSince?: string;
};

export type AgentDetail = {
  agentId: string;
  systemId: string;
  label: string;
  role?: string;
  asOf?: string;
  picksLive?: boolean;
  holdings: string[];
  exposurePct: number;
  exposureReason?: string;
  metrics: {
    days: number;
    totalReturnPct: number;
    maxDrawdownPct: number;
    equity: number;
  };
  backtestRef?: { cagr?: string; maxDd?: string };
  trades?: AgentTrade[];
  equitySeries?: AgentEquityPoint[];
  regimeLabel?: string;
  regimeBadge?: string;
  isHoldVariant?: boolean;
  usesLedgerHoldings?: boolean;
  holdSince?: string;
  holdCadenceLabel?: string;
  parentId?: string;
};

export type ScannerAgentsPayload = {
  connected?: boolean;
  generatedAt?: string;
  scannerGeneratedAt?: string;
  picksLive?: boolean;
  asOf?: string;
  crewStartDate?: string;
  initialCapital?: number;
  agentCount?: number;
  leaderboard?: AgentLeaderboardRow[];
  agents?: Record<string, AgentDetail>;
  note?: string;
  message?: string;
  source?: string;
};

function withNormalizedLeaderboard(payload: ScannerAgentsPayload): ScannerAgentsPayload {
  return {
    ...payload,
    leaderboard: normalizeAgentLeaderboard(payload.leaderboard),
  };
}

function scannerBucketName() {
  return process.env.SCANNER_RESULTS_GCS_BUCKET || process.env.PUBLISHED_ASSETS_BUCKET || '';
}

function agentsObjectName() {
  return process.env.SCANNER_AGENTS_GCS_OBJECT || 'scanner/agent_crew_dashboard.json';
}

async function loadAgentsFromGcs(): Promise<ScannerAgentsPayload | null> {
  const bucketName = scannerBucketName();
  if (!bucketName) return null;

  initializeFirebaseAdmin();
  const [content] = await getStorage().bucket(bucketName).file(agentsObjectName()).download();
  const parsed = JSON.parse(content.toString('utf8'));
  if (!parsed || typeof parsed !== 'object') {
    return { connected: false, message: 'Agents payload was empty.', leaderboard: [] };
  }
  return withNormalizedLeaderboard({ ...(parsed as ScannerAgentsPayload), source: 'gcs' });
}

async function loadAgentsFromFile(): Promise<ScannerAgentsPayload | null> {
  const candidates = [
    process.env.SCANNER_AGENTS_JSON_PATH,
    process.env.NODE_ENV === 'development'
      ? path.resolve(process.cwd(), '../Projects/stocks/scanners/agent_crew_dashboard.json')
      : null,
  ].filter(Boolean) as string[];

  for (const jsonPath of candidates) {
    try {
      const raw = await readFile(jsonPath, 'utf8');
      return withNormalizedLeaderboard({ ...(JSON.parse(raw) as ScannerAgentsPayload), source: 'file' });
    } catch {
      continue;
    }
  }
  return null;
}

export async function loadScannerAgents(): Promise<ScannerAgentsPayload> {
  try {
    const cloudData = await loadAgentsFromGcs();
    if (cloudData) return withNormalizedLeaderboard(cloudData);
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load agents from cloud storage.');
    const fileData = await loadAgentsFromFile().catch(() => null);
    if (fileData) return withNormalizedLeaderboard(fileData);
    return { connected: false, message, leaderboard: [], agents: {} };
  }

  const fileData = await loadAgentsFromFile();
  if (fileData) return withNormalizedLeaderboard(fileData);

  return {
    connected: false,
    message: 'Data is refreshing. Check back shortly.',
    leaderboard: [],
    agents: {},
  };
}
