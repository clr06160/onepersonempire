import { NextResponse } from 'next/server';

import { requireScannerSession } from '@/lib/scanner-auth';
import { loadDeskBriefImage } from '@/lib/scanner-desk-brief';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const asOf = new URL(req.url).searchParams.get('asOf') || undefined;
    const image = await loadDeskBriefImage(asOf || undefined);
    if (!image) {
      return NextResponse.json({ error: 'No morning image yet.' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(image.buffer), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load morning image.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
