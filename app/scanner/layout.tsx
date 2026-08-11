import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getProductBaseUrl } from '@/lib/scanner-product-urls';

import ScannerFooter from './_extras/ScannerFooter';

const productBase = getProductBaseUrl();

const DREAM_TREE_DESCRIPTION =
  'Private market scanner - find leading themes, then act from the Flight Deck with a survival brake.';

export const metadata: Metadata = {
  metadataBase: new URL(productBase),
  title: {
    default: 'Dream Tree Stocks',
    template: '%s · Dream Tree Stocks',
  },
  description: DREAM_TREE_DESCRIPTION,
  openGraph: {
    type: 'website',
    siteName: 'Dream Tree Stocks',
    title: 'Dream Tree Stocks',
    description: DREAM_TREE_DESCRIPTION,
    url: '/',
    images: [
      {
        url: '/brand/dream-tree-og.png',
        width: 1200,
        height: 630,
        alt: 'Dream Tree Stocks',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dream Tree Stocks',
    description: DREAM_TREE_DESCRIPTION,
    images: ['/brand/dream-tree-og.png'],
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/brand/dream-tree-favicon.png?v=11', type: 'image/png', sizes: '512x512' },
      { url: '/brand/dream-tree-favicon.ico?v=11', sizes: '48x48' },
    ],
    shortcut: '/brand/dream-tree-favicon.ico?v=11',
    apple: '/brand/dream-tree-favicon.png?v=11',
  },
};

export default function ScannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ScannerFooter />
    </>
  );
}
