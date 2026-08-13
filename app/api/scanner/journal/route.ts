import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';
import {
  createJournalEntry,
  listJournalEntries,
  validateCreateInput,
} from '@/lib/scanner-journal';

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const entries = await listJournalEntries(normalizeEmail(user.email));
    return NextResponse.json({ user, entries });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load journal.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const validated = validateCreateInput({
    ticker: body.ticker,
    buyDate: body.buyDate,
    buyAmount: body.buyAmount,
    sellDate: body.sellDate,
    sellAmount: body.sellAmount,
    reason: body.reason,
    notes: body.notes,
    lens: body.lens,
    pickSnapshot: body.pickSnapshot,
  } as Parameters<typeof validateCreateInput>[0]);

  if ('error' in validated && validated.error) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const id = await createJournalEntry(normalizeEmail(user.email), validated.value!);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not save journal entry.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
