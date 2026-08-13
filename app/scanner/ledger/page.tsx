import type { Metadata } from 'next';

import ForwardLedgerClient from './ForwardLedgerClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Forward-test ledger',
  description:
    'Proprietary database of every scanner forward-test trade — analyze anytime, improve the playbook.',
  openGraph: {
    title: 'Forward-test ledger · Dream Tree Stocks',
    description:
      'Proprietary database of every scanner forward-test trade — analyze anytime, improve the playbook.',
  },
};

export default function ForwardLedgerPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-emerald-800/40 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.14),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-400">
            Dream Tree · Proprietary ledger
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Forward-test ledger</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
            Every closed paper trade from the scanner&apos;s forward tests, stored so history
            accumulates. Run analysis anytime — or read the monthly improvement notes on Monthly
            reports.
          </p>
        </header>
        <ForwardLedgerClient />
      </div>
    </main>
  );
}
