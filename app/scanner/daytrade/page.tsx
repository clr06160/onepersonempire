import Link from 'next/link';

import DayTradeClient from './DayTradeClient';

export const dynamic = 'force-dynamic';

export default function DayTradePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">Private scanner</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Day trade — 3× ETFs</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">
                Stretch / bounce scores for SOXL, TQQQ, KORU and other leveraged names. Built for
                mean-reversion scalps after big down days — not a forecast.
              </p>
            </div>
            <Link href="/scanner" className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">
              Open scanner
            </Link>
          </div>
        </div>

        <DayTradeClient />
      </div>
    </main>
  );
}
