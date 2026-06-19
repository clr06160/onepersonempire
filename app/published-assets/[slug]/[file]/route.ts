import { getPublishedAsset } from '@/lib/published-sites';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; file: string }> },
) {
  const { slug, file } = await params;
  const asset = await getPublishedAsset(slug, file);

  if (!asset) {
    return new Response('Asset not found.', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  return new Response(new Uint8Array(asset.buffer), {
    headers: {
      'content-type': asset.contentType,
      'cache-control': asset.cacheControl,
    },
  });
}
