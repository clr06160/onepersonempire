import { FieldValue } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebase-admin';
import type { ScannerAlertEvents, ScannerAlertPrefs } from '@/lib/scanner-alert-prefs-types';

const PREFS_COLLECTION = 'scannerAlertPrefs';
const SIGNAL_DOC = 'scannerAlertSignals/latest';
const OUTBOX_COLLECTION = 'scannerAlertOutbox';

export type AlertSignalSnapshot = {
  powerTrendOn: boolean;
  powerTrendLabel: string;
  bookTickers: string[];
  cashBrake: boolean;
  monthKey?: string;
  asOf: string;
  generatedAt: string;
  /** Live scoreboard total return % (paper forward book). */
  totalReturnPct?: number;
};

export type FiredAlertEvent = {
  id: keyof ScannerAlertEvents;
  title: string;
  detail: string;
};

export async function listEnabledAlertPrefs(): Promise<ScannerAlertPrefs[]> {
  const snapshot = await getAdminFirestore().collection(PREFS_COLLECTION).where('enabled', '==', true).get();
  const rows: ScannerAlertPrefs[] = [];
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const events = (data.events || {}) as Partial<ScannerAlertEvents>;
    rows.push({
      email: String(data.email || doc.id).trim().toLowerCase(),
      enabled: true,
      events: {
        ptFlip: events.ptFlip !== false,
        bookChange: events.bookChange !== false,
        cashBrake: events.cashBrake !== false,
        morningPostcard: Boolean(events.morningPostcard),
      },
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
    });
  }
  return rows.filter((row) => row.email.includes('@'));
}

export async function loadSignalSnapshot(): Promise<AlertSignalSnapshot | null> {
  const doc = await getAdminFirestore().doc(SIGNAL_DOC).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return {
    powerTrendOn: Boolean(data.powerTrendOn),
    powerTrendLabel: String(data.powerTrendLabel || ''),
    bookTickers: Array.isArray(data.bookTickers)
      ? data.bookTickers.map((t: unknown) => String(t).toUpperCase())
      : [],
    cashBrake: Boolean(data.cashBrake),
    monthKey: data.monthKey ? String(data.monthKey) : undefined,
    asOf: String(data.asOf || ''),
    generatedAt: String(data.generatedAt || ''),
  };
}

export async function saveSignalSnapshot(snapshot: AlertSignalSnapshot): Promise<void> {
  await getAdminFirestore()
    .doc(SIGNAL_DOC)
    .set(
      {
        ...snapshot,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export function diffBookTickers(
  previous: string[] | null | undefined,
  current: string[],
): { added: string[]; removed: string[] } {
  const prev = previous || [];
  const prevSet = new Set(prev);
  const nextSet = new Set(current);
  return {
    added: current.filter((t) => !prevSet.has(t)),
    removed: prev.filter((t) => !nextSet.has(t)),
  };
}

export function diffAlertEvents(
  previous: AlertSignalSnapshot | null,
  current: AlertSignalSnapshot,
): FiredAlertEvent[] {
  if (!previous) return [];

  const fired: FiredAlertEvent[] = [];

  if (previous.powerTrendOn !== current.powerTrendOn) {
    fired.push({
      id: 'ptFlip',
      title: 'PowerTrend flipped',
      detail: `${previous.powerTrendOn ? 'ON' : 'OFF'} → ${current.powerTrendOn ? 'ON' : 'OFF'}${
        current.powerTrendLabel ? ` (${current.powerTrendLabel})` : ''
      }`,
    });
  }

  const prevBook = previous.bookTickers.join(',');
  const nextBook = current.bookTickers.join(',');
  if (prevBook !== nextBook) {
    const { added, removed } = diffBookTickers(previous.bookTickers, current.bookTickers);
    const parts = [
      added.length ? `+${added.join(',')}` : '',
      removed.length ? `−${removed.join(',')}` : '',
    ].filter(Boolean);
    fired.push({
      id: 'bookChange',
      title: 'Flight Deck book changed',
      detail: parts.length ? parts.join(' · ') : `Now: ${current.bookTickers.join(' · ') || 'empty'}`,
    });
  }

  if (!previous.cashBrake && current.cashBrake) {
    fired.push({
      id: 'cashBrake',
      title: 'Cash brake ON',
      detail: current.monthKey
        ? `Month ${current.monthKey} tripped — sit cash until next month.`
        : 'Monthly survival brake armed — sit cash.',
    });
  }

  return fired;
}

export async function writeAlertOutbox(entry: {
  to: string;
  subject: string;
  body: string;
  events: string[];
  status: 'sent' | 'skipped' | 'failed';
  error?: string;
}): Promise<void> {
  await getAdminFirestore().collection(OUTBOX_COLLECTION).add({
    ...entry,
    createdAt: FieldValue.serverTimestamp(),
  });
}
