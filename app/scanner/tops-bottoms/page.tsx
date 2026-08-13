import type { Metadata } from 'next';

import TopsBottomsClient from './TopsBottomsClient';

export const metadata: Metadata = {
  title: 'Tops & bottoms | Dream Tree Stocks',
  description:
    'Wave-4 exit playbook, sector move priors, and double top/bottom holdout study.',
  openGraph: {
    title: 'Tops & bottoms | Dream Tree Stocks',
    description:
      'Wave-4 exit playbook, sector move priors, and double top/bottom holdout study.',
  },
};

export default function TopsBottomsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-400">
            Research
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">Tops & bottoms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Ride wave 3, exit on wave 4 (failed 10/21 after a sector-sized run). Exact tops stay hard —
            wave 5 is fickle.
          </p>
        </header>
        <TopsBottomsClient />
      </div>
    </main>
  );
}
