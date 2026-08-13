import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { getJournalEntry, setJournalChartFlag } from '@/lib/scanner-journal';
import { deleteJournalChart, readJournalChart, saveJournalChart, validateChartUpload } from '@/lib/scanner-journal-storage';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;
  const email = normalizeEmail(user.email);
  const entry = await getJournalEntry(email, id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  }

  const chart = await readJournalChart(email, id);
  if (!chart) {
    return NextResponse.json({ error: 'Chart not found.' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(chart.buffer), {
    headers: {
      'Content-Type': chart.contentType,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function POST(req: Request, context: RouteContext) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;
  const email = normalizeEmail(user.email);
  const entry = await getJournalEntry(email, id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get('chart');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Choose a chart screenshot to upload.' }, { status: 400 });
  }

  const contentType = file.type || 'image/png';
  const validation = validateChartUpload(contentType, file.size);
  if ('error' in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await deleteJournalChart(email, id);
    await saveJournalChart(email, id, buffer, contentType);
    await setJournalChartFlag(email, id, true);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not save chart.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const { id } = await context.params;
  const email = normalizeEmail(user.email);
  const entry = await getJournalEntry(email, id);
  if (!entry) {
    return NextResponse.json({ error: 'Entry not found.' }, { status: 404 });
  }

  await deleteJournalChart(email, id);
  await setJournalChartFlag(email, id, false);
  return NextResponse.json({ ok: true });
}
