import { verifyPublishedSiteEditAccess } from '@/lib/published-sites';
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

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get('slug') || '';
    const key = req.nextUrl.searchParams.get('key') || '';

    if (!slug.trim() || !key.trim()) {
      return NextResponse.json({ error: 'Pass slug and key to load a published site for editing.' }, { status: 400 });
    }

    const site = await verifyPublishedSiteEditAccess(slug, key);
    if (!site) {
      return NextResponse.json({
        error: 'Site not found or edit key is wrong. Use the private edit link from when you published, or republish once to get a new link.',
      }, { status: 404 });
    }

    const url = new URL(`/s/${site.slug}`, getPublicOrigin(req)).toString();
    return NextResponse.json({
      slug: site.slug,
      html: site.html,
      idea: site.idea || '',
      updatedAt: site.updatedAt,
      url,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not load published site.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
