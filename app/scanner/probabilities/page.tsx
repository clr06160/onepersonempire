import ProbabilitiesClient from './ProbabilitiesClient';

export const dynamic = 'force-dynamic';

export default function ProbabilitiesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
            Private scanner · scoreboard
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Probabilities</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Live odds and historical hit rates pulled from your scanner sleeves — pain risk, bounce win rates, COT
            paper, Fed futures, and a tongue-in-cheek &quot;will this make me rich?&quot; card. Educational, not a
            forecast.
          </p>
        </div>
        <ProbabilitiesClient />
      </div>
    </main>
  );
}
