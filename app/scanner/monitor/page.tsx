import AdaptiveMonitorClient from './AdaptiveMonitorClient';

export const dynamic = 'force-dynamic';

export default function AdaptiveMonitorPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner</p>
          <h1 className="text-4xl font-bold tracking-tight">Adaptive Monitor</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Daily learning loop — trends, weaknesses, and what to try next. Refreshes with the scanner upload each
            morning (~7:35 AM local).
          </p>
        </div>
        <AdaptiveMonitorClient />
      </div>
    </main>
  );
}
