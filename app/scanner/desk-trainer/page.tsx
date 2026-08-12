import DeskTrainerClient from './DeskTrainerClient';

export const dynamic = 'force-dynamic';

export default function DeskTrainerPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-sky-800/35 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.16),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-400">
            Private scanner · daily ticket desk
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Risk Trainer</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-300">
            Each day the scanner prints an explicit ticket — SELL, BUY, HOLD, SIZE — on a hidden historical window.
            Follow it, or override under fear pressure. The rules book always runs the ticket so you can score yourself.
          </p>
        </header>
        <DeskTrainerClient />
      </div>
    </main>
  );
}
