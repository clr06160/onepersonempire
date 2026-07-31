import CupHandleClient from './CupHandleClient';

export const dynamic = 'force-dynamic';

export default function CupHandlePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · extras</p>
          <h1 className="text-4xl font-bold tracking-tight">Cup with Handle Liquid Leaders</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            IBD / O&apos;Neil cup-with-handle breakouts in liquid market leaders — buy at the pivot, with a
            5-year backtest run separately for each universe (IWM Top 200, NASDAQ-100, MidCap 100, S&amp;P 500).
          </p>
        </div>
        <CupHandleClient />
      </div>
    </main>
  );
}
