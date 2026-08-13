import ValuationsClient from './ValuationsClient';

export const dynamic = 'force-dynamic';

export default function ValuationsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
            Private scanner · valuations
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Valuations</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            A scan-only cockpit for momentum names: forward estimates, analyst target upside, historical valuation
            stretch, and animal-style risk labels that help answer how much runway may be left.
          </p>
        </div>
        <ValuationsClient />
      </div>
    </main>
  );
}
