import type { Metadata } from 'next';

import MonthlyReportsClient from './MonthlyReportsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Monthly reports',
  description:
    'Leaders earnings reaction report by month — PASS+ / FAIL− day+3, plain sales/earnings facts, parent trends.',
  openGraph: {
    title: 'Monthly reports · Dream Tree Stocks',
    description:
      'Leaders earnings reaction report by month — PASS+ / FAIL− day+3, plain sales/earnings facts, parent trends.',
  },
};

export default function MonthlyReportsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-sky-800/40 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-400">
            Dream Tree · Monthly reports
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Monthly reports</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
            How Leaders names settled after earnings each month — who cleared +10% day+3, who failed
            −10%, and which parents are trending. Forward calendar stays on Earnings calendar; this
            is the after-action report.
          </p>
        </header>
        <MonthlyReportsClient />
      </div>
    </main>
  );
}
