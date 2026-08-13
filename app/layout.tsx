import type { Metadata } from "next";
import { headers } from "next/headers";

import { isDreamTreeStocksHost } from "@/lib/custom-domain-host";

import "./globals.css";

const DREAM_TREE_DESCRIPTION =
  "Private market scanner - find leading themes, then act from the Flight Deck with a survival brake.";

const BUILDER_METADATA: Metadata = {
  title: "OnePerson Empire",
  description: "Build, edit, and publish a simple local business website.",
};

const DREAM_TREE_METADATA: Metadata = {
  metadataBase: new URL("https://dreamtreestocks.com"),
  // Title comes from app/scanner/layout.tsx so the template does not double-wrap.
  description: DREAM_TREE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Dream Tree Stocks",
    title: "Dream Tree Stocks",
    description: DREAM_TREE_DESCRIPTION,
    url: "https://dreamtreestocks.com",
    images: [
      {
        url: "/brand/dream-tree-og.png",
        width: 1200,
        height: 630,
        alt: "Dream Tree Stocks",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dream Tree Stocks",
    description: DREAM_TREE_DESCRIPTION,
    images: ["/brand/dream-tree-og.png"],
  },
  alternates: {
    canonical: "https://dreamtreestocks.com",
  },
  icons: {
    icon: [
      { url: "/brand/dream-tree-favicon.png?v=11", type: "image/png", sizes: "512x512" },
      { url: "/brand/dream-tree-favicon.ico?v=11", sizes: "48x48" },
    ],
    shortcut: "/brand/dream-tree-favicon.ico?v=11",
    apple: "/brand/dream-tree-favicon.png?v=11",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
  return isDreamTreeStocksHost(host) ? DREAM_TREE_METADATA : BUILDER_METADATA;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
