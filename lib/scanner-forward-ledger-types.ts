/**
 * Shared types for the proprietary forward-test trade ledger.
 * Client-safe (no Firebase / Node-only imports).
 */

export type ForwardLedgerSystemId =
  | 'earnings-calendar'
  | 'shortlist'
  | 'catalysts'
  | 'valuations'
  | 'daytrade-soxs'
  | 'daytrade-armor'
  | 'chess-selection'
  | 'cot'
  | 'raw-bear'
  | 'pe-glass'
  | 'first-pullbacks'
  | 'bracket'
  | 'cockpit';

export type ForwardLedgerTradeKind = 'ticker' | 'basket' | 'event';

export type ForwardLedgerTag =
  | 'crypto-miner'
  | 'crypto-adjacent'
  | 'ai-infra'
  | 'high-beta-narrative'
  | 'stopped-out'
  | 'winner'
  | 'loser';

export type ForwardLedgerTrade = {
  /** Stable id: system|sleeve|ticker|entry|exit */
  id: string;
  systemId: ForwardLedgerSystemId;
  systemLabel: string;
  kind: ForwardLedgerTradeKind;
  ticker: string;
  company?: string | null;
  sleeve?: string | null;
  sector?: string | null;
  entryDate: string;
  exitDate?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  returnPct?: number | null;
  stopped?: boolean;
  exitReason?: string | null;
  status: 'open' | 'closed';
  tags: ForwardLedgerTag[];
  /** Calendar month of exit (or entry if still open): YYYY-MM */
  monthKey: string;
  sourceNote?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
};

export type ForwardLedgerCohortStat = {
  key: string;
  label: string;
  tradeCount: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
  hitRatePct: number | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  totalReturnPctSum: number | null;
  bestTicker?: string | null;
  bestReturnPct?: number | null;
  worstTicker?: string | null;
  worstReturnPct?: number | null;
};

export type ForwardLedgerRecommendation = {
  id: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  systemId?: ForwardLedgerSystemId | 'all';
  title: string;
  detail: string;
  evidence: string[];
  action: string;
};

export type ForwardLedgerAnalysis = {
  generatedAt: string;
  scope: 'all' | 'month';
  monthKey?: string | null;
  monthLabel?: string | null;
  tradeCount: number;
  closedCount: number;
  openCount: number;
  hitRatePct: number | null;
  avgReturnPct: number | null;
  medianReturnPct: number | null;
  bySystem: ForwardLedgerCohortStat[];
  byTag: ForwardLedgerCohortStat[];
  bySleeve: ForwardLedgerCohortStat[];
  topWinners: ForwardLedgerTrade[];
  topLosers: ForwardLedgerTrade[];
  recommendations: ForwardLedgerRecommendation[];
  method: string[];
  note?: string | null;
};

export type ForwardLedgerSyncResult = {
  scannedSystems: number;
  upserted: number;
  closedSeen: number;
  openSeen: number;
  errors: { systemId: string; message: string }[];
  asOf: string;
};

export type ForwardLedgerPayload = {
  connected: boolean;
  trades: ForwardLedgerTrade[];
  analysis: ForwardLedgerAnalysis | null;
  sync?: ForwardLedgerSyncResult | null;
  message?: string;
};
