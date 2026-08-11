import ForestClient from './ForestClient';

export const dynamic = 'force-dynamic';

export default function ForestPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · Fun</p>
          <h1 className="text-4xl font-bold tracking-tight">The Forest</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Each scanner universe as a stand of leaves — one per current pick, colored by health
            and shaped by its growth character. Tap a leaf for plain English. Toggle between IWM,
            QQQ, MidCap and SPY; the healthiest names lead each grove.
          </p>
        </div>
        <ForestClient />
      </div>
    </main>
  );
}
