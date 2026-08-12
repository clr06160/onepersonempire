import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

const COLLECTION = 'scannerRequests';
const RESULTS_COLLECTION = 'scannerRequestResults';
const MAX_TITLE_LENGTH = 120;
const MAX_DETAILS_LENGTH = 2500;

function cleanText(value: unknown, maxLength: number) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanDetails(value: unknown) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
    .slice(0, MAX_DETAILS_LENGTH);
}

function formatDate(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const snapshot = await getAdminFirestore()
      .collection(COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(25)
      .get();

    const requests = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || '',
        details: data.details || '',
        status: data.status || 'new',
        submittedByName: data.submittedByName || '',
        submittedByRole: data.submittedByRole || 'viewer',
        createdAt: formatDate(data.createdAt),
      };
    });

    const resultsSnapshot = await getAdminFirestore()
      .collection(RESULTS_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const results = resultsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        requestId: data.requestId || '',
        title: data.title || '',
        summary: data.summary || '',
        metrics: data.metrics || '',
        caveats: data.caveats || '',
        submittedByName: data.submittedByName || '',
        createdAt: formatDate(data.createdAt),
      };
    });

    return NextResponse.json({ user, requests, results });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load scan requests.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { title?: unknown; details?: unknown };
  const title = cleanText(body.title, MAX_TITLE_LENGTH);
  const details = cleanDetails(body.details);

  if (!title || title.length < 8) {
    return NextResponse.json({ error: 'Give the scan request a short title.' }, { status: 400 });
  }
  if (!details || details.length < 20) {
    return NextResponse.json({ error: 'Describe the scan idea in a little more detail.' }, { status: 400 });
  }

  try {
    const doc = await getAdminFirestore()
      .collection(COLLECTION)
      .add({
        title,
        details,
        status: 'new',
        submittedByEmail: user.email,
        submittedByName: user.name || user.email,
        submittedByRole: user.role,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json(
      {
        request: {
          id: doc.id,
          title,
          details,
          status: 'new',
          submittedByName: user.name || user.email,
          submittedByRole: user.role,
          createdAt: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not save scan request.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
