import type { Metadata } from 'next';

import LeadersClient from './LeadersClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leaders',
  description:
    'Find the leading microtheme by relative strength vs QQQ, then open the roster of strongest names.',
  openGraph: {
    title: 'Leaders · Dream Tree Stocks',
    description:
      'Find the leading microtheme by relative strength vs QQQ, then open the roster of strongest names.',
  },
  twitter: {
    title: 'Leaders · Dream Tree Stocks',
    description:
      'Find the leading microtheme by relative strength vs QQQ, then open the roster of strongest names.',
  },
};

export default function LeadersPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-cyan-800/40 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.14),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400">
            Dream Tree · Leaders
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Leaders</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-300">
            Find the leading microtheme first, then the strongest names inside it. Click any row to
            open the roster.
          </p>
        </header>
        <LeadersClient />
      </div>
    </main>
  );
}
