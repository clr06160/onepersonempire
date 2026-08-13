import { isAppHost, isDreamTreeStocksHost, normalizeHost } from '@/lib/custom-domain-host';
import { NextRequest, NextResponse } from 'next/server';

<<<<<<< HEAD
const APP_ONLY_PREFIXES = ['/builder', '/scanner', '/success', '/privacy', '/terms'];
=======
const APP_ONLY_PREFIXES = ['/builder', '/scanner', '/success', '/ebitda'];
>>>>>>> 3903701 (Add standalone EBITDA margin trend research page)

function shouldServePublishedSite(pathname: string) {
  if (pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/_next/')) return false;
  if (pathname.startsWith('/published-assets/')) return false;
  if (pathname.startsWith('/i/')) return false;
  if (pathname.startsWith('/pitch-deck')) return false;
  if (pathname.startsWith('/privacy')) return false;
  if (pathname.startsWith('/terms')) return false;
  if (APP_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return false;
  return true;
}

export async function proxy(request: NextRequest) {
  const host = normalizeHost(
    request.headers.get('x-forwarded-host') || request.headers.get('host'),
  );

  // dreamtreestocks.com product host: serve the scanner brochure at `/`
  // (rewrite keeps the home URL for link previews — do not 302 away).
  if (isDreamTreeStocksHost(host)) {
    const pathname = request.nextUrl.pathname;
    if (pathname === '/' || pathname === '') {
      const url = request.nextUrl.clone();
      url.pathname = '/scanner';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (isAppHost(host)) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;

  if (APP_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const fallbackHost = process.env.NEXT_PUBLIC_BASE_URL
      || process.env.PUBLISH_PUBLIC_BASE_URL
      || 'https://onepersonempire.web.app';
    return NextResponse.redirect(new URL('/', fallbackHost));
  }

  if (!shouldServePublishedSite(pathname)) {
    return NextResponse.next();
  }

  const lookupUrl = new URL('/api/custom-domain', request.url);
  lookupUrl.searchParams.set('host', host);

  try {
    const response = await fetch(lookupUrl, { cache: 'no-store' });
    if (!response.ok) return NextResponse.next();

    const data = await response.json() as { slug?: string | null };
    if (!data.slug) return NextResponse.next();

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/s/${data.slug}`;
    return NextResponse.rewrite(rewriteUrl);
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
