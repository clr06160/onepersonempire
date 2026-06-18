import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

const COLLECTION = 'scannerRequestResults';
const MAX_TITLE_LENGTH = 140;
const MAX_TEXT_LENGTH = 3000;

function cleanSingleLine(value: unknown, maxLength: number) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanLongText(value: unknown) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

export async function POST(req: Request) {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Developer access required.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    requestId?: unknown;
    title?: unknown;
    summary?: unknown;
    metrics?: unknown;
    caveats?: unknown;
  };
  const requestId = cleanSingleLine(body.requestId, 160);
  const title = cleanSingleLine(body.title, MAX_TITLE_LENGTH);
  const summary = cleanLongText(body.summary);
  const metrics = cleanLongText(body.metrics);
  const caveats = cleanLongText(body.caveats);

  if (!title || title.length < 8) {
    return NextResponse.json({ error: 'Give the test result a short title.' }, { status: 400 });
  }
  if (!summary || summary.length < 20) {
    return NextResponse.json({ error: 'Summarize what was tested and what happened.' }, { status: 400 });
  }

  try {
    const doc = await getAdminFirestore()
      .collection(COLLECTION)
      .add({
        requestId,
        title,
        summary,
        metrics,
        caveats,
        submittedByEmail: user.email,
        submittedByName: user.name || user.email,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json(
      {
        result: {
          id: doc.id,
          requestId,
          title,
          summary,
          metrics,
          caveats,
          submittedByName: user.name || user.email,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save test result.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
