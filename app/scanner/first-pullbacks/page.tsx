import FirstPullbacksClient from './FirstPullbacksClient';

export const dynamic = 'force-dynamic';

export default function FirstPullbacksPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-amber-800/35 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-400">
            Private scanner · forward laboratory
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">First Pullbacks</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-300">
            Raschke-style first pullback after a thrust off a low — then rank the pool like Core by acceleration.
            Top 10 is the forward paper book (monthly). Research sleeve: historically calmer than raw accel, and it
            tended to look better in soft or volatile tape — not a Core replacement.
          </p>
        </header>
        <FirstPullbacksClient />
      </div>
    </main>
  );
}
