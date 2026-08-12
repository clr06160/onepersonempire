import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { isDreamTreeStocksHost } from '@/lib/custom-domain-host';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');

  if (!isDreamTreeStocksHost(host)) {
    return [
      {
        url: 'https://onepersonempire.web.app/',
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 1,
      },
    ];
  }

  const base = 'https://dreamtreestocks.com';
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${base}/scanner`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/scanner/fun`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${base}/scanner/forest`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
  ];
}
