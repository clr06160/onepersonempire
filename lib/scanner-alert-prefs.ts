import { FieldValue } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebase-admin';
import type { ScannerAlertEvents, ScannerAlertPrefs } from '@/lib/scanner-alert-prefs-types';

export type { ScannerAlertEvents, ScannerAlertPrefs } from '@/lib/scanner-alert-prefs-types';

const COLLECTION = 'scannerAlertPrefs';

const DEFAULT_EVENTS: ScannerAlertEvents = {
  ptFlip: true,
  bookChange: true,
  cashBrake: true,
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function defaultAlertPrefs(accountEmail: string): ScannerAlertPrefs {
  return {
    email: normalizeEmail(accountEmail),
    enabled: false,
    events: { ...DEFAULT_EVENTS },
  };
}

export async function getAlertPrefs(accountEmail: string): Promise<ScannerAlertPrefs> {
  const key = normalizeEmail(accountEmail);
  const snapshot = await getAdminFirestore().collection(COLLECTION).doc(key).get();
  if (!snapshot.exists) return defaultAlertPrefs(key);
  const data = snapshot.data() || {};
  const events = (data.events || {}) as Partial<ScannerAlertEvents>;
  return {
    email: normalizeEmail(String(data.email || key)),
    enabled: Boolean(data.enabled),
    events: {
      ptFlip: events.ptFlip !== false,
      bookChange: events.bookChange !== false,
      cashBrake: events.cashBrake !== false,
    },
    onboardingCompletedAt: data.onboardingCompletedAt
      ? String(data.onboardingCompletedAt)
      : undefined,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || undefined,
  };
}

export function validateAlertPrefsInput(input: {
  email?: unknown;
  enabled?: unknown;
  events?: unknown;
  onboardingCompletedAt?: unknown;
}): { error: string } | { value: Omit<ScannerAlertPrefs, 'updatedAt'> } {
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : '';
  if (!email || !isValidEmail(email)) {
    return { error: 'Enter a valid email address for alerts.' };
  }

  const rawEvents = (input.events && typeof input.events === 'object' ? input.events : {}) as Record<
    string,
    unknown
  >;

  const onboardingCompletedAt =
    typeof input.onboardingCompletedAt === 'string' && input.onboardingCompletedAt.trim()
      ? input.onboardingCompletedAt.trim()
      : undefined;

  return {
    value: {
      email,
      enabled: Boolean(input.enabled),
      events: {
        ptFlip: rawEvents.ptFlip !== false,
        bookChange: rawEvents.bookChange !== false,
        cashBrake: rawEvents.cashBrake !== false,
      },
      ...(onboardingCompletedAt ? { onboardingCompletedAt } : {}),
    },
  };
}

export async function saveAlertPrefs(
  accountEmail: string,
  prefs: Omit<ScannerAlertPrefs, 'updatedAt'>,
): Promise<ScannerAlertPrefs> {
  const key = normalizeEmail(accountEmail);
  const payload: Record<string, unknown> = {
    email: prefs.email,
    enabled: prefs.enabled,
    events: prefs.events,
    accountEmail: key,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (prefs.onboardingCompletedAt) {
    payload.onboardingCompletedAt = prefs.onboardingCompletedAt;
  }
  await getAdminFirestore().collection(COLLECTION).doc(key).set(payload, { merge: true });
  return {
    ...prefs,
    updatedAt: new Date().toISOString(),
  };
}
