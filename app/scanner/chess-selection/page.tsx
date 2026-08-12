import ChessSelectionClient from './ChessSelectionClient';

export const dynamic = 'force-dynamic';

export default function ChessSelectionPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-amber-800/35 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.16),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-400">
            Private scanner · daily forward laboratory
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Chess Selection</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-300">
            The selection game, Raw PowerTrend, and the winners metric choose the pieces. The chess game manages the
            position. The regime game decides how hard to press. Nine paper books update daily — including a
            climate-switched draft that changes the picker by climate label, plus a chess-managed version of the
            Aggressive Raw Top10 sleeve that is winning now. The page also includes the trading tutorial distilled
            from the evidence: what to buy, how to manage it, and what habits to avoid.
          </p>
        </header>
        <ChessSelectionClient />
      </div>
    </main>
  );
}
