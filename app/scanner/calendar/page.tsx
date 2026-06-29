import EarningsCalendarClient from './EarningsCalendarClient';

export const dynamic = 'force-dynamic';

export default function EarningsCalendarPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · extras</p>
          <h1 className="text-4xl font-bold tracking-tight">Earnings Calendar</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Upcoming earnings dates — filtered to names that were strong reactors last time, with each
            stock&apos;s last reaction shown so you can decide whether to play it.
          </p>
        </div>
        <EarningsCalendarClient />
      </div>
    </main>
  );
}
