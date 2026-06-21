import FmpScreenerClient from './FmpScreenerClient';

export const dynamic = 'force-dynamic';

export default function FmpScreenerPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · extras</p>
          <h1 className="text-4xl font-bold tracking-tight">FMP Fundamentals Screener</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            From HolyRollerFmpScreener.ipynb — raw Rule of 40, sales/EPS/FCF growth, gross margin expansion, and
            earnings reaction scores for the top-ranked names.
          </p>
        </div>
        <FmpScreenerClient />
      </div>
    </main>
  );
}
