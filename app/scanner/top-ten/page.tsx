import TopTenClient from './TopTenClient';

export const dynamic = 'force-dynamic';

export default function TopTenPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · funnel</p>
          <h1 className="text-4xl font-bold tracking-tight">Top Ten</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Forward paper test on the veto shortlist: hold equal-weight top 10 survivors, replace when a name falls out.
            Track total return, drawdown, and every rebalance to see if this system works.
          </p>
        </div>
        <TopTenClient />
      </div>
    </main>
  );
}
