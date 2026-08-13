import { sendOutboundSms } from '@/lib/outbound-sms';
import { verifyPublishedSiteEditAccess } from '@/lib/published-sites';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { slug, key, phone, editUrl } = await req.json();
    const normalizedSlug = typeof slug === 'string' ? slug : '';
    const editToken = typeof key === 'string' ? key : '';
    const destination = typeof phone === 'string' ? phone : '';
    const link = typeof editUrl === 'string' ? editUrl : '';

    if (!normalizedSlug.trim() || !editToken.trim() || !destination.trim() || !link.trim()) {
      return NextResponse.json({ error: 'Pass slug, key, phone, and editUrl.' }, { status: 400 });
    }

    const site = await verifyPublishedSiteEditAccess(normalizedSlug, editToken);
    if (!site) {
      return NextResponse.json({ error: 'Edit link is invalid or expired.' }, { status: 404 });
    }

    const message = [
      `Your private edit link for ${site.slug}:`,
      link,
      '',
      'Bookmark this to edit your site later. Do not share publicly.',
    ].join('\n');

    const result = await sendOutboundSms({ to: destination, body: message });
    if (!result.sent) {
      return NextResponse.json({ sent: false, reason: result.reason }, { status: 200 });
    }

    return NextResponse.json({ sent: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not send edit link.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
