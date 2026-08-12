'use client';

import Link from 'next/link';
import { useEffect } from 'react';

type ChartsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** Route-level boundary — chart failures stay on /scanner/charts only. */
export default function ChartsError({ error, reset }: ChartsErrorProps) {
  useEffect(() => {
    console.error('[scanner/charts]', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-xl border border-amber-300 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Charts (beta)</p>
        <h1 className="mt-2 text-2xl font-bold">Chart preview unavailable</h1>
        <p className="mt-3 text-zinc-600">
          Something went wrong loading the chart module. The main scanner and other tools are unaffected.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-600"
          >
            Try again
          </button>
          <Link
            href="/scanner"
            className="rounded-full border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:border-emerald-600"
          >
            Back to scanner
          </Link>
        </div>
      </div>
    </main>
  );
}
