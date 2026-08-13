import Top100Client from './Top100Client';

export const dynamic = 'force-dynamic';

export default function Top100Page() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · extras</p>
          <h1 className="text-4xl font-bold tracking-tight">Top 100 Stocks</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            A performance leaderboard ranked by Weighted Alpha and sortable by % change over any window —
            5D, 1M, 3M, YTD, 52W, and out to 10 years. See which names have led across each universe.
          </p>
        </div>
        <Top100Client />
      </div>
    </main>
  );
}
