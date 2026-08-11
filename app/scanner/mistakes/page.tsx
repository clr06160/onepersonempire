import Link from 'next/link';

import { hardRuleCount, mistakeRuleCount } from '@/lib/scanner-mistakes-rules';

import MistakesClient from './MistakesClient';

export const dynamic = 'force-dynamic';

export default function MistakesPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-amber-400">
            Private scanner · discipline
          </p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Mistakes</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">
                {mistakeRuleCount()} rules written from mistakes that already cost money, {hardRuleCount()} of them hard
                stops. Read before the open, not after the damage. These are not a frame of reference — they exist to
                override me.
              </p>
            </div>
            <Link
              href="/scanner"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
            >
              Open scanner
            </Link>
          </div>
        </div>

        <MistakesClient />
      </div>
    </main>
  );
}
