import CatalystsClient from './CatalystsClient';

export const dynamic = 'force-dynamic';

export default function CatalystsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
            Private scanner · catalysts
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Catalysts</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            A theme-decomposition cockpit for current scanner picks. It looks for hard events, theme clusters,
            price/volume confirmation, and new phrases that may point to the next part of a trend waking up.
          </p>
        </div>
        <CatalystsClient />
      </div>
    </main>
  );
}
