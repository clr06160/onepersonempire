import { deleteJournalChart, readJournalChart } from '@/lib/scanner-journal-storage';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';
import {
  computeJournalReturn,
  type JournalEntry,
  type JournalLens,
  type JournalPickSnapshot,
} from '@/lib/scanner-journal-shared';

export const JOURNAL_COLLECTION = 'scannerJournalEntries';

export type { JournalEntry, JournalLens, JournalPickSnapshot } from '@/lib/scanner-journal-shared';

const MAX_TICKER = 12;
const MAX_REASON = 2000;
const MAX_NOTES = 2000;

export function normalizeTicker(value: unknown) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, MAX_TICKER);
}

export function normalizeDate(value: unknown) {
  const raw = String(value || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

export function normalizeMoney(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const raw =
    typeof value === 'string'
      ? value.trim().replace(/[$,\s]/g, '')
      : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export function cleanJournalText(value: unknown, maxLength: number) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, maxLength);
}

export function normalizeLens(value: unknown): JournalLens {
  const lens = String(value || 'manual').trim().toLowerCase();
  if (lens === 'top-ten' || lens === 'earnings' || lens === 'agent' || lens === 'scanner' || lens === 'other') {
    return lens;
  }
  return 'manual';
}

export function formatFirestoreDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export function journalDocToEntry(id: string, data: Record<string, unknown>): JournalEntry {
  const sellDate = data.sellDate ? String(data.sellDate).slice(0, 10) : null;
  const buyAmount = normalizeMoney(data.buyAmount);
  const sellAmount = normalizeMoney(data.sellAmount);
  const metrics = computeJournalReturn(buyAmount, sellAmount);
  return {
    id,
    ticker: String(data.ticker || '').toUpperCase(),
    buyDate: String(data.buyDate || '').slice(0, 10),
    buyAmount,
    sellDate,
    sellAmount,
    returnPct: data.returnPct != null ? Number(data.returnPct) : metrics.returnPct,
    pnlDollars: data.pnlDollars != null ? Number(data.pnlDollars) : metrics.pnlDollars,
    reason: String(data.reason || ''),
    notes: data.notes ? String(data.notes) : '',
    lens: normalizeLens(data.lens),
    status: sellDate ? 'closed' : 'open',
    pickSnapshot: (data.pickSnapshot as JournalPickSnapshot | undefined) || null,
    hasChart: Boolean(data.hasChart),
    createdAt: formatFirestoreDate(data.createdAt),
    updatedAt: formatFirestoreDate(data.updatedAt),
  };
}

export async function listJournalEntries(ownerEmail: string, limit = 200): Promise<JournalEntry[]> {
  const snapshot = await getAdminFirestore()
    .collection(JOURNAL_COLLECTION)
    .where('ownerEmail', '==', ownerEmail)
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => journalDocToEntry(doc.id, doc.data()))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
      const buy = (b.buyDate || '').localeCompare(a.buyDate || '');
      if (buy !== 0) return buy;
      return (a.ticker || '').localeCompare(b.ticker || '');
    });
}

export async function getJournalEntry(ownerEmail: string, id: string): Promise<JournalEntry | null> {
  const doc = await getAdminFirestore().collection(JOURNAL_COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  if (String(data.ownerEmail || '').toLowerCase() !== ownerEmail.toLowerCase()) return null;
  return journalDocToEntry(doc.id, data);
}

export type CreateJournalInput = {
  ticker: string;
  buyDate: string;
  buyAmount?: number | string | null;
  sellDate?: string;
  sellAmount?: number | string | null;
  reason?: string;
  notes?: string;
  lens?: JournalLens;
  pickSnapshot?: JournalPickSnapshot | null;
};

function buildMetrics(buyAmount: number | null, sellAmount: number | null) {
  const { returnPct, pnlDollars } = computeJournalReturn(buyAmount, sellAmount);
  return {
    returnPct: returnPct == null ? null : Math.round(returnPct * 10) / 10,
    pnlDollars: pnlDollars == null ? null : Math.round(pnlDollars * 100) / 100,
  };
}

export function validateCreateInput(body: CreateJournalInput) {
  const ticker = normalizeTicker(body.ticker);
  const buyDate = normalizeDate(body.buyDate);
  const sellDate = body.sellDate ? normalizeDate(body.sellDate) : '';
  const buyAmount = normalizeMoney(body.buyAmount);
  const sellAmount = body.sellAmount != null && body.sellAmount !== '' ? normalizeMoney(body.sellAmount) : null;
  const reason = cleanJournalText(body.reason, MAX_REASON);
  const notes = cleanJournalText(body.notes, MAX_NOTES);
  const lens = normalizeLens(body.lens);

  if (!ticker) return { error: 'Enter a ticker symbol.' };
  if (!buyDate) return { error: 'Enter a valid buy date.' };
  if (buyAmount == null || buyAmount <= 0) return { error: 'Enter buy dollar amount.' };
  if (body.sellDate && !sellDate) return { error: 'Sell date must be YYYY-MM-DD.' };
  if (sellDate && sellDate < buyDate) return { error: 'Sell date cannot be before buy date.' };
  if (sellDate && sellAmount == null) return { error: 'Enter sell dollar amount to close.' };

  const metrics = buildMetrics(buyAmount, sellAmount);

  return {
    value: {
      ticker,
      buyDate,
      buyAmount,
      sellDate: sellDate || null,
      sellAmount,
      reason,
      notes,
      lens,
      pickSnapshot: body.pickSnapshot || null,
      ...metrics,
    },
  };
}

export async function createJournalEntry(ownerEmail: string, input: NonNullable<ReturnType<typeof validateCreateInput>['value']>) {
  const doc = await getAdminFirestore()
    .collection(JOURNAL_COLLECTION)
    .add({
      ownerEmail,
      ticker: input.ticker,
      buyDate: input.buyDate,
      buyAmount: input.buyAmount,
      sellDate: input.sellDate,
      sellAmount: input.sellAmount,
      returnPct: input.returnPct,
      pnlDollars: input.pnlDollars,
      reason: input.reason,
      notes: input.notes || '',
      lens: input.lens,
      pickSnapshot: input.pickSnapshot,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  return doc.id;
}

export async function updateJournalEntry(
  ownerEmail: string,
  id: string,
  patch: Partial<CreateJournalInput>,
) {
  const existing = await getJournalEntry(ownerEmail, id);
  if (!existing) return { error: 'Entry not found.' };

  const buyAmount = patch.buyAmount != null ? normalizeMoney(patch.buyAmount) : existing.buyAmount ?? null;
  const sellDate =
    patch.sellDate === ''
      ? null
      : patch.sellDate != null
        ? normalizeDate(patch.sellDate) || null
        : existing.sellDate;
  const sellAmount =
    patch.sellAmount === ''
      ? null
      : patch.sellAmount != null
        ? normalizeMoney(patch.sellAmount)
        : existing.sellAmount ?? null;

  const next = {
    ticker: patch.ticker != null ? normalizeTicker(patch.ticker) : existing.ticker,
    buyDate: patch.buyDate != null ? normalizeDate(patch.buyDate) : existing.buyDate,
    buyAmount,
    sellDate,
    sellAmount,
    reason: patch.reason != null ? cleanJournalText(patch.reason, MAX_REASON) : existing.reason,
    notes: patch.notes != null ? cleanJournalText(patch.notes, MAX_NOTES) : existing.notes || '',
    lens: patch.lens != null ? normalizeLens(patch.lens) : existing.lens || 'manual',
    pickSnapshot: patch.pickSnapshot !== undefined ? patch.pickSnapshot : existing.pickSnapshot,
  };

  if (!next.ticker) return { error: 'Enter a valid ticker.' };
  if (!next.buyDate) return { error: 'Enter a valid buy date.' };
  if (next.buyAmount == null || next.buyAmount <= 0) return { error: 'Buy amount required.' };
  if (next.sellDate && next.sellDate < next.buyDate) return { error: 'Sell date cannot be before buy date.' };
  if (next.sellDate && (next.sellAmount == null || next.sellAmount < 0)) {
    return { error: 'Sell amount required when closing.' };
  }

  const metrics = buildMetrics(next.buyAmount, next.sellAmount);

  await getAdminFirestore()
    .collection(JOURNAL_COLLECTION)
    .doc(id)
    .update({
      ...next,
      ...metrics,
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { id };
}

export async function deleteJournalEntry(ownerEmail: string, id: string) {
  const existing = await getJournalEntry(ownerEmail, id);
  if (!existing) return { error: 'Entry not found.' };
  await deleteJournalChart(ownerEmail, id);
  await getAdminFirestore().collection(JOURNAL_COLLECTION).doc(id).delete();
  return { ok: true };
}

export async function setJournalChartFlag(ownerEmail: string, id: string, hasChart: boolean) {
  const existing = await getJournalEntry(ownerEmail, id);
  if (!existing) return { error: 'Entry not found.' };
  await getAdminFirestore().collection(JOURNAL_COLLECTION).doc(id).update({
    hasChart,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
}

export async function loadJournalChart(ownerEmail: string, id: string) {
  const existing = await getJournalEntry(ownerEmail, id);
  if (!existing) return { error: 'Entry not found.' as const };
  const chart = await readJournalChart(ownerEmail, id);
  if (!chart) return { error: 'Chart not found.' as const };
  return { chart };
}
