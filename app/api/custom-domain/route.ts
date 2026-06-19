import {
  getCustomDomainDetailsForSlug,
  getSlugForHost,
  normalizeDomain,
  saveCustomDomain,
} from '@/lib/custom-domains';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host');
  const slug = req.nextUrl.searchParams.get('slug');

  try {
    if (host) {
      const mappedSlug = await getSlugForHost(host);
      if (!mappedSlug) {
        return NextResponse.json({ slug: null }, { status: 404 });
      }
      return NextResponse.json({ slug: mappedSlug });
    }

    if (slug) {
      const details = await getCustomDomainDetailsForSlug(slug);
      if (!details) {
        return NextResponse.json({ domain: null, hosting: null });
      }

      return NextResponse.json({
        domain: details.apexDomain,
        hosting: details.hosting,
      });
    }

    return NextResponse.json({ error: 'Pass host or slug.' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Custom domain lookup failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const slug = typeof body.slug === 'string' ? body.slug : '';
    const domain = typeof body.domain === 'string' ? body.domain : '';

    const { record, hosting } = await saveCustomDomain({ slug, domain });
    const apexDomain = normalizeDomain(domain);

    return NextResponse.json({
      slug: record.slug,
      domain: apexDomain,
      wwwUrl: `https://www.${apexDomain}`,
      hosting,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Custom domain save failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
