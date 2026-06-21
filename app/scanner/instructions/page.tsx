import ScannerInstructionsClient from './ScannerInstructionsClient';

export const dynamic = 'force-dynamic';

export default function ScannerInstructionsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner</p>
          <h1 className="text-4xl font-bold tracking-tight">How to trade each scan</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Detailed instructions for every system on the dashboard — rebalance calendars, PowerTrend vs QQQ200 half,
            which ticker list to use, and how the 191–197% hybrid actually works (weekly only when PowerTrend is ON).
          </p>
        </div>
        <ScannerInstructionsClient />
      </div>
    </main>
  );
}
