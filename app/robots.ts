import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { isDreamTreeStocksHost } from '@/lib/custom-domain-host';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');

  if (isDreamTreeStocksHost(host)) {
    return {
      rules: {
        userAgent: '*',
        allow: '/',
      },
      sitemap: 'https://dreamtreestocks.com/sitemap.xml',
      host: 'https://dreamtreestocks.com',
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  };
}
