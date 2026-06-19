import {
  createInvoice,
  extractPaymentInstructionsFromHtml,
  extractPaymentLinkFromHtml,
  extractVenmoPhoneFromHtml,
  formatVenmoInvoiceInstructions,
} from '@/lib/invoices';
import { getPublishedSite, normalizeSlug } from '@/lib/published-sites';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function getPublicOrigin(req: NextRequest) {
  if (process.env.PUBLISH_PUBLIC_BASE_URL) {
    return process.env.PUBLISH_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https');
  return host ? `${protocol}://${host}` : req.nextUrl.origin;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = normalizeSlug(typeof body.slug === 'string' ? body.slug : '');
    const description = String(body.description || '').trim();
    const amount = Number(String(body.amount || '').replace(/[$,]/g, ''));
    const customerName = String(body.customerName || '').trim();

    if (!slug) {
      return NextResponse.json({ error: 'Missing site slug.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Enter a valid invoice amount.' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'Enter what the invoice is for.' }, { status: 400 });
    }

    const site = await getPublishedSite(slug);
    if (!site) {
      return NextResponse.json({ error: `No published site found for "${slug}".` }, { status: 404 });
    }

    const amountCents = Math.round(amount * 100);
    const venmoPhone = extractVenmoPhoneFromHtml(site.html);
    const paymentInstructions = venmoPhone
      ? formatVenmoInvoiceInstructions({ amountCents, description, venmoPhone })
      : extractPaymentInstructionsFromHtml(site.html);

    const invoice = await createInvoice({
      siteSlug: slug,
      customerName: customerName || undefined,
      description,
      amountCents,
      paymentUrl: extractPaymentLinkFromHtml(site.html),
      paymentInstructions,
    });

    const invoiceUrl = new URL(`/i/${invoice.id}`, getPublicOrigin(req)).toString();
    return NextResponse.json({ ok: true, invoice, invoiceUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create invoice.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
