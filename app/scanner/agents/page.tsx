import ScannerAgentsClient from './ScannerAgentsClient';

export const dynamic = 'force-dynamic';

export default function ScannerAgentsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-violet-400">Agent tournament</p>
          <h1 className="text-4xl font-bold tracking-tight">Forward paper test</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            One agent per scanner system — each follows that scan&apos;s picks, exposure overlays, and rebalance rules
            daily. Tracks equity, holdings, and trades forward from $100k each.
          </p>
        </div>
        <ScannerAgentsClient />
      </div>
    </main>
  );
}
