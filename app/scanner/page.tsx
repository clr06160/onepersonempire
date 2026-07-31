import { Suspense } from 'react';

import ScannerPageClient from './ScannerPageClient';

export const dynamic = 'force-dynamic';

export default function ScannerPage() {
  const googleClientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-950 px-4 py-10 text-center text-zinc-400">
          Loading scanner…
        </main>
      }
    >
      <ScannerPageClient googleClientId={googleClientId} previewPolish />
    </Suspense>
  );
}
