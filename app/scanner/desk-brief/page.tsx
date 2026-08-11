import type { Metadata } from 'next';

import DeskBriefClient from './DeskBriefClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Morning note',
  description:
    'Daily Dream Tree desk note — tape, trends, positioning, and the week ahead.',
  openGraph: {
    title: 'Morning note · Dream Tree Stocks',
    description: 'Daily desk synthesis for members — original, not a wire reprint.',
  },
};

export default function DeskBriefPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-amber-800/40 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.16),transparent_40%),linear-gradient(160deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-400">
            Dream Tree · Desk
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Morning note</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
            One original desk message each day — plus a fresh Nano Banana image of yesterday&apos;s
            tape — covering what moved, what is trending, how to lean the book, and what to watch.
          </p>
        </header>
        <DeskBriefClient />
      </div>
    </main>
  );
}
