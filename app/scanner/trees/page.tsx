import TreesClient from './TreesClient';

export const dynamic = 'force-dynamic';

export default function TreesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Dream Tree Stocks</p>
          <h1 className="text-4xl font-bold tracking-tight">Market Trees</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Whole indices rendered as one living tree — every leaf a stock, the canopy colored by
            return. Scrub year by year through market history, watch it bloom and wither, and toggle
            a full ranked leaderboard for any year.
          </p>
        </div>
        <TreesClient />
      </div>
    </main>
  );
}
