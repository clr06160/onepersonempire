'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const ChartsPreviewClient = dynamic(() => import('./ChartsPreviewClient'), {
  ssr: false,
  loading: () => (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-[1600px] rounded-xl border border-zinc-300 bg-white p-8 text-zinc-500">
        Loading chart preview…
      </div>
    </main>
  ),
});

export default function ChartsPageLoader() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-6">
          <div className="mx-auto max-w-[1600px] rounded-xl border border-zinc-300 bg-white p-8 text-zinc-500">
            Loading chart preview…
          </div>
        </main>
      }
    >
      <ChartsPreviewClient />
    </Suspense>
  );
}
