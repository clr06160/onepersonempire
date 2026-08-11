import BracketClient from './BracketClient';

export const dynamic = 'force-dynamic';

export default function BracketPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-sky-800/40 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-400">
            Private scanner · forward laboratory
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Horizontal Bracket</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-300">
            Prior-day high/low box for chop / rotation days. Buy the lower third, sell the upper third — prefer
            failed breaks that reclaim the box. Forward-tested overnight (no minute ORB history). Stand down when
            the tape is trending hard.
          </p>
        </header>
        <BracketClient />
      </div>
    </main>
  );
}
