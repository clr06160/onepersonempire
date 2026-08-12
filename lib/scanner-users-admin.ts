import { getAdminFirestore } from '@/lib/firebase-admin';
import type { ScannerRole } from '@/lib/scanner-auth';
import { listWaitlist } from '@/lib/scanner-waitlist';

export type ScannerUserRecord = {
  email: string;
  name?: string | null;
  picture?: string | null;
  role: ScannerRole;
  googleSub?: string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  /** Where this row came from for the admin UI. */
  source?: 'firestore' | 'allowlist' | 'waitlist';
  hasSignedIn?: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseEmailList(value: string | undefined) {
  return (value || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
}

/** Create or refresh a viewer on first successful Google login (open signup). */
export async function ensureOpenSignupViewer(input: {
  email: string;
  name?: string;
  picture?: string;
  googleSub?: string;
}): Promise<ScannerRole | null> {
  const email = normalizeEmail(input.email);
  if (!email) return null;

  const db = getAdminFirestore();
  const ref = db.collection('scannerUsers').doc(email);
  const snap = await ref.get();
  const now = new Date().toISOString();

  if (snap.exists) {
    const data = snap.data() || {};
    if (data.active === false) return null;
    const role: ScannerRole = data.role === 'developer' ? 'developer' : 'viewer';
    await ref.set(
      {
        email,
        name: input.name || data.name || null,
        picture: input.picture || data.picture || null,
        googleSub: input.googleSub || data.googleSub || null,
        role,
        active: true,
        lastLoginAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    return role;
  }

  await ref.set({
    email,
    name: input.name || null,
    picture: input.picture || null,
    googleSub: input.googleSub || null,
    role: 'viewer',
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    source: 'open-signup',
  });
  return 'viewer';
}

/** Record login for allowlisted / known users so the Users page shows activity. */
export async function touchScannerUserLogin(input: {
  email: string;
  name?: string;
  picture?: string;
  googleSub?: string;
  role: ScannerRole;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  if (!email) return;
  const db = getAdminFirestore();
  const ref = db.collection('scannerUsers').doc(email);
  const snap = await ref.get();
  const now = new Date().toISOString();
  if (snap.exists) {
    const data = snap.data() || {};
    await ref.set(
      {
        name: input.name || data.name || null,
        picture: input.picture || data.picture || null,
        googleSub: input.googleSub || data.googleSub || null,
        lastLoginAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
    return;
  }
  await ref.set({
    email,
    name: input.name || null,
    picture: input.picture || null,
    googleSub: input.googleSub || null,
    role: input.role,
    active: true,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    source: 'login-touch',
  });
}

function fromFirestoreDoc(docId: string, data: Record<string, unknown>): ScannerUserRecord {
  const email = normalizeEmail(String(data.email || docId));
  const lastLoginAt = typeof data.lastLoginAt === 'string' ? data.lastLoginAt : null;
  return {
    email,
    name: typeof data.name === 'string' ? data.name : null,
    picture: typeof data.picture === 'string' ? data.picture : null,
    role: data.role === 'developer' ? 'developer' : 'viewer',
    googleSub: typeof data.googleSub === 'string' ? data.googleSub : null,
    active: data.active !== false,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    lastLoginAt,
    source: 'firestore',
    hasSignedIn: Boolean(lastLoginAt),
  };
}

export type ScannerUsersLists = {
  all: ScannerUserRecord[];
  signedIn: ScannerUserRecord[];
};

/** Full directory: Firestore accounts + env allowlists + waitlist emails. */
export async function listScannerUsersDirectory(): Promise<ScannerUsersLists> {
  const db = getAdminFirestore();
  const byEmail = new Map<string, ScannerUserRecord>();

  const snap = await db.collection('scannerUsers').limit(1000).get();
  for (const doc of snap.docs) {
    const row = fromFirestoreDoc(doc.id, (doc.data() || {}) as Record<string, unknown>);
    byEmail.set(row.email, row);
  }

  for (const email of parseEmailList(process.env.SCANNER_DEVELOPER_EMAILS)) {
    const existing = byEmail.get(email);
    if (existing) {
      existing.role = 'developer';
      continue;
    }
    byEmail.set(email, {
      email,
      role: 'developer',
      active: true,
      source: 'allowlist',
      hasSignedIn: false,
      name: null,
      picture: null,
      googleSub: null,
      createdAt: null,
      updatedAt: null,
      lastLoginAt: null,
    });
  }

  for (const email of parseEmailList(process.env.SCANNER_ALLOWED_EMAILS)) {
    if (byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      role: 'viewer',
      active: true,
      source: 'allowlist',
      hasSignedIn: false,
      name: null,
      picture: null,
      googleSub: null,
      createdAt: null,
      updatedAt: null,
      lastLoginAt: null,
    });
  }

  try {
    const waitlist = await listWaitlist(300);
    for (const entry of waitlist) {
      const email = normalizeEmail(entry.email);
      if (!email || byEmail.has(email)) continue;
      byEmail.set(email, {
        email,
        role: 'viewer',
        active: true,
        source: 'waitlist',
        hasSignedIn: false,
        name: null,
        picture: null,
        googleSub: null,
        createdAt: entry.createdAt || null,
        updatedAt: entry.updatedAt || null,
        lastLoginAt: null,
      });
    }
  } catch {
    // Waitlist optional if collection missing/index issues.
  }

  const all = Array.from(byEmail.values()).sort((a, b) => {
    const aKey = a.lastLoginAt || a.createdAt || a.email;
    const bKey = b.lastLoginAt || b.createdAt || b.email;
    return bKey.localeCompare(aKey);
  });
  const signedIn = all.filter((row) => row.hasSignedIn);

  return { all, signedIn };
}

/** Soft-disable (or re-enable). Creates a Firestore row if needed so env/waitlist emails can be cut. */
export async function setScannerUserActive(email: string, active: boolean): Promise<ScannerUserRecord | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const db = getAdminFirestore();
  const ref = db.collection('scannerUsers').doc(normalized);
  const snap = await ref.get();
  const now = new Date().toISOString();

  const developers = new Set(parseEmailList(process.env.SCANNER_DEVELOPER_EMAILS));
  const role: ScannerRole = developers.has(normalized)
    ? 'developer'
    : snap.exists && snap.data()?.role === 'developer'
      ? 'developer'
      : 'viewer';

  if (!snap.exists) {
    await ref.set({
      email: normalized,
      role,
      active,
      createdAt: now,
      updatedAt: now,
      source: 'admin-toggle',
    });
  } else {
    await ref.set({ active, updatedAt: now }, { merge: true });
  }

  const data = (await ref.get()).data() || {};
  const lastLoginAt = typeof data.lastLoginAt === 'string' ? data.lastLoginAt : null;
  return {
    email: normalized,
    name: typeof data.name === 'string' ? data.name : null,
    picture: typeof data.picture === 'string' ? data.picture : null,
    role: data.role === 'developer' ? 'developer' : 'viewer',
    googleSub: typeof data.googleSub === 'string' ? data.googleSub : null,
    active: data.active !== false,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    lastLoginAt,
    source: 'firestore',
    hasSignedIn: Boolean(lastLoginAt),
  };
}
