import Link from 'next/link';
import ScannerRequestsClient from './ScannerRequestsClient';

export const dynamic = 'force-dynamic';

export default function ScannerRequestsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Scan Request Board</h1>
              <p className="mt-3 max-w-2xl text-zinc-300">
                A simple place for approved users to suggest scanner and backtest ideas before any manual review or local run.
              </p>
            </div>
            <Link href="/scanner" className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">
              Open scanner
            </Link>
          </div>
        </div>

        <ScannerRequestsClient />
      </div>
    </main>
  );
}
