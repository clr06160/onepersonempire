import { FieldValue, type Query } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebase-admin';
import type {
  ForwardLedgerSystemId,
  ForwardLedgerTrade,
  ForwardLedgerTradeKind,
} from '@/lib/scanner-forward-ledger-types';
import { tagForwardTrade } from '@/lib/scanner-forward-ledger-tags';

export const FORWARD_LEDGER_COLLECTION = 'scannerForwardLedgerTrades';

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

export function monthKeyFromDate(value?: string | null) {
  const raw = String(value || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return '';
}

export function buildForwardLedgerTradeId(parts: {
  systemId: string;
  sleeve?: string | null;
  ticker: string;
  entryDate: string;
  exitDate?: string | null;
}) {
  return [
    parts.systemId,
    parts.sleeve || '-',
    String(parts.ticker || '').toUpperCase(),
    parts.entryDate || '-',
    parts.exitDate || 'open',
  ].join('|');
}

export function normalizeLedgerTrade(input: {
  systemId: ForwardLedgerSystemId;
  systemLabel: string;
  kind?: ForwardLedgerTradeKind;
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
  status?: 'open' | 'closed';
  sourceNote?: string | null;
}): ForwardLedgerTrade | null {
  const ticker = String(input.ticker || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 16);
  const entryDate = String(input.entryDate || '').slice(0, 10);
  if (!ticker || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return null;

  const exitDate = input.exitDate ? String(input.exitDate).slice(0, 10) : null;
  const status = input.status || (exitDate ? 'closed' : 'open');
  const returnPct =
    input.returnPct == null || Number.isNaN(Number(input.returnPct))
      ? null
      : round1(Number(input.returnPct));

  const tags = tagForwardTrade({
    ticker,
    company: input.company,
    returnPct,
    stopped: Boolean(input.stopped),
  });

  const monthKey = monthKeyFromDate(exitDate || entryDate);
  if (!monthKey) return null;

  return {
    id: buildForwardLedgerTradeId({
      systemId: input.systemId,
      sleeve: input.sleeve,
      ticker,
      entryDate,
      exitDate,
    }),
    systemId: input.systemId,
    systemLabel: input.systemLabel,
    kind: input.kind || 'ticker',
    ticker,
    company: input.company || null,
    sleeve: input.sleeve || null,
    sector: input.sector || null,
    entryDate,
    exitDate,
    entryPrice: input.entryPrice ?? null,
    exitPrice: input.exitPrice ?? null,
    returnPct,
    stopped: Boolean(input.stopped),
    exitReason: input.exitReason || null,
    status,
    tags,
    monthKey,
    sourceNote: input.sourceNote || null,
  };
}

function formatFirestoreDate(value: unknown) {
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function firestoreDocToLedgerTrade(id: string, data: Record<string, unknown>): ForwardLedgerTrade {
  return {
    id,
    systemId: data.systemId as ForwardLedgerTrade['systemId'],
    systemLabel: String(data.systemLabel || data.systemId || ''),
    kind: (data.kind as ForwardLedgerTrade['kind']) || 'ticker',
    ticker: String(data.ticker || '').toUpperCase(),
    company: data.company != null ? String(data.company) : null,
    sleeve: data.sleeve != null ? String(data.sleeve) : null,
    sector: data.sector != null ? String(data.sector) : null,
    entryDate: String(data.entryDate || '').slice(0, 10),
    exitDate: data.exitDate ? String(data.exitDate).slice(0, 10) : null,
    entryPrice: data.entryPrice != null ? Number(data.entryPrice) : null,
    exitPrice: data.exitPrice != null ? Number(data.exitPrice) : null,
    returnPct: data.returnPct != null ? Number(data.returnPct) : null,
    stopped: Boolean(data.stopped),
    exitReason: data.exitReason != null ? String(data.exitReason) : null,
    status: data.status === 'open' ? 'open' : 'closed',
    tags: Array.isArray(data.tags) ? (data.tags as ForwardLedgerTrade['tags']) : [],
    monthKey: String(data.monthKey || monthKeyFromDate(String(data.exitDate || data.entryDate || ''))),
    sourceNote: data.sourceNote != null ? String(data.sourceNote) : null,
    firstSeenAt: formatFirestoreDate(data.firstSeenAt),
    lastSeenAt: formatFirestoreDate(data.lastSeenAt),
  };
}

export async function upsertForwardLedgerTrades(trades: ForwardLedgerTrade[]) {
  if (!trades.length) return { upserted: 0 };

  const db = getAdminFirestore();
  const batchSize = 200;
  let upserted = 0;

  for (let i = 0; i < trades.length; i += batchSize) {
    const chunk = trades.slice(i, i + batchSize);
    const refs = chunk.map((trade) => db.collection(FORWARD_LEDGER_COLLECTION).doc(trade.id));
    const existing = await db.getAll(...refs);
    const batch = db.batch();

    chunk.forEach((trade, idx) => {
      const ref = refs[idx];
      const prior = existing[idx];
      const payload = {
        id: trade.id,
        systemId: trade.systemId,
        systemLabel: trade.systemLabel,
        kind: trade.kind,
        ticker: trade.ticker,
        company: trade.company ?? null,
        sleeve: trade.sleeve ?? null,
        sector: trade.sector ?? null,
        entryDate: trade.entryDate,
        exitDate: trade.exitDate ?? null,
        entryPrice: trade.entryPrice ?? null,
        exitPrice: trade.exitPrice ?? null,
        returnPct: trade.returnPct ?? null,
        stopped: Boolean(trade.stopped),
        exitReason: trade.exitReason ?? null,
        status: trade.status,
        tags: trade.tags,
        monthKey: trade.monthKey,
        sourceNote: trade.sourceNote ?? null,
        lastSeenAt: FieldValue.serverTimestamp(),
        ...(prior.exists && prior.data()?.firstSeenAt
          ? {}
          : { firstSeenAt: FieldValue.serverTimestamp() }),
      };
      batch.set(ref, payload, { merge: true });
    });

    await batch.commit();
    upserted += chunk.length;
  }

  return { upserted };
}

export async function listForwardLedgerTrades(options?: {
  monthKey?: string | null;
  systemId?: string | null;
  limit?: number;
}): Promise<ForwardLedgerTrade[]> {
  const limit = Math.min(Math.max(options?.limit || 2000, 1), 5000);
  let query: Query = getAdminFirestore().collection(FORWARD_LEDGER_COLLECTION);

  if (options?.monthKey) {
    query = query.where('monthKey', '==', options.monthKey);
  }
  if (options?.systemId) {
    query = query.where('systemId', '==', options.systemId);
  }

  const snapshot = await query.limit(limit).get();
  return snapshot.docs
    .map((doc) => firestoreDocToLedgerTrade(doc.id, doc.data()))
    .sort((a, b) => {
      const exit = String(b.exitDate || b.entryDate).localeCompare(String(a.exitDate || a.entryDate));
      if (exit !== 0) return exit;
      return a.ticker.localeCompare(b.ticker);
    });
}
