import { FieldValue } from 'firebase-admin/firestore';

import { getAdminFirestore } from '@/lib/firebase-admin';

const COLLECTION = 'scannerWaitlist';

export type WaitlistTrust = {
  score: number; // 0–100, higher = more human/legit
  likelyBot: boolean;
  signals: string[];
};

export type ScannerWaitlistEntry = {
  id: string;
  email: string;
  message: string;
  status: 'new' | 'contacted' | 'approved' | 'declined' | 'spam';
  trustScore?: number;
  likelyBot?: boolean;
  signals?: string[];
  createdAt?: string;
  updatedAt?: string;
};

const DISPOSABLE_HINTS = [
  'mailinator.com',
  'guerrillamail.com',
  'tempmail',
  '10minutemail',
  'trashmail',
  'yopmail.com',
  'sharklasers.com',
];

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateWaitlistInput(input: {
  email?: unknown;
  message?: unknown;
}): { error: string } | { value: { email: string; message: string } } {
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : '';
  if (!email || !isValidEmail(email)) {
    return { error: 'Enter a valid email address.' };
  }
  const message = String(input.message || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, 1000);
  return { value: { email, message } };
}

export function scoreWaitlistTrust(input: {
  email: string;
  message: string;
  honeypotFilled: boolean;
  dwellMs: number;
  userAgent: string;
}): WaitlistTrust {
  const signals: string[] = [];
  let score = 70;

  if (input.honeypotFilled) {
    signals.push('honeypot');
    score -= 60;
  }

  if (!Number.isFinite(input.dwellMs) || input.dwellMs < 1800) {
    signals.push('submitted_too_fast');
    score -= 35;
  } else if (input.dwellMs > 8000) {
    signals.push('reasonable_dwell');
    score += 8;
  }

  if (!input.userAgent || input.userAgent.length < 12) {
    signals.push('missing_user_agent');
    score -= 25;
  } else if (/bot|crawler|spider|curl|wget|python-requests/i.test(input.userAgent)) {
    signals.push('bot_user_agent');
    score -= 40;
  }

  const domain = input.email.split('@')[1] || '';
  if (DISPOSABLE_HINTS.some((hint) => domain.includes(hint))) {
    signals.push('disposable_email');
    score -= 30;
  }

  const msg = input.message.trim();
  if (!msg) {
    signals.push('empty_message');
    score -= 5;
  } else if (msg.length >= 40) {
    signals.push('wrote_a_note');
    score += 12;
  }

  if (/(https?:\/\/|viagra|crypto airdrop|seo service|buy followers)/i.test(msg)) {
    signals.push('spammy_message');
    score -= 40;
  }

  if (/(i trade|drawdown|momentum|scanner|powertrend|portfolio|swing)/i.test(msg)) {
    signals.push('trader_language');
    score += 10;
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    likelyBot: score < 40 || input.honeypotFilled,
    signals,
  };
}

export async function upsertWaitlistInterest(input: {
  email: string;
  message: string;
  sourceHost?: string;
  trust: WaitlistTrust;
}): Promise<ScannerWaitlistEntry | null> {
  if (input.trust.likelyBot) {
    // Silently accept for the bot; do not pollute the real inbox.
    return null;
  }

  const email = normalizeEmail(input.email);
  const ref = getAdminFirestore().collection(COLLECTION).doc(email);
  const existing = await ref.get();
  const payload = {
    email,
    message: input.message,
    sourceHost: input.sourceHost || '',
    trustScore: input.trust.score,
    likelyBot: input.trust.likelyBot,
    signals: input.trust.signals,
    status: existing.exists ? (existing.data()?.status || 'new') : 'new',
    updatedAt: FieldValue.serverTimestamp(),
    ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  };
  await ref.set(payload, { merge: true });
  return {
    id: email,
    email,
    message: input.message,
    status: (payload.status as ScannerWaitlistEntry['status']) || 'new',
    trustScore: input.trust.score,
    likelyBot: false,
    signals: input.trust.signals,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function listWaitlist(limit = 100): Promise<ScannerWaitlistEntry[]> {
  const snapshot = await getAdminFirestore()
    .collection(COLLECTION)
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      email: String(data.email || doc.id),
      message: String(data.message || ''),
      status: (data.status as ScannerWaitlistEntry['status']) || 'new',
      trustScore: typeof data.trustScore === 'number' ? data.trustScore : undefined,
      likelyBot: Boolean(data.likelyBot),
      signals: Array.isArray(data.signals) ? data.signals.map(String) : [],
      createdAt: data.createdAt?.toDate?.()?.toISOString?.(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.(),
    };
  });
}
