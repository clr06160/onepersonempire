import EarningsGlassClient from './EarningsGlassClient';

export const dynamic = 'force-dynamic';

export default function EarningsGlassPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-gradient-to-br from-cyan-950/30 via-zinc-900/80 to-emerald-950/20 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-400">
            Private scanner · visual fundamentals
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Earnings Glass</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Peter Lynch trick, made fun: each scanner pick is a glass.{' '}
            <span className="text-emerald-300">Earnings growth fills the liquid.</span>{' '}
            <span className="text-amber-300">Price is the floating bead.</span> When the bead sits above the juice,
            the stock ran ahead of earnings — stretched P/E in one glance. Your valuations animal watches from the rim.
          </p>
        </div>
        <EarningsGlassClient />
      </div>
    </main>
  );
}
