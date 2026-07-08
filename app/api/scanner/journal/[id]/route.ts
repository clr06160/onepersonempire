import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';
import {
  deleteJournalEntry,
  getJournalEntry,
  updateJournalEntry,
} from '@/lib/scanner-journal';

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    const result = await updateJournalEntry(normalizeEmail(user.email), id, {
      ticker: body.ticker,
      buyDate: body.buyDate,
      buyAmount: body.buyAmount,
      sellDate: body.sellDate,
      sellAmount: body.sellAmount,
      reason: body.reason,
      notes: body.notes,
      lens: body.lens,
      pickSnapshot: body.pickSnapshot,
    } as Parameters<typeof updateJournalEntry>[2]);

    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const entry = await getJournalEntry(normalizeEmail(user.email), id);
    return NextResponse.json({ entry });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not update journal entry.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await deleteJournalEntry(normalizeEmail(user.email), id);
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not delete journal entry.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
