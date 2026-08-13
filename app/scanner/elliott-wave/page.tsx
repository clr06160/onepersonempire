import ElliottWaveClient from './ElliottWaveClient';

export const dynamic = 'force-dynamic';

export default function ElliottWavePage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-violet-400">Private scanner · regime</p>
          <h1 className="text-4xl font-bold tracking-tight">Elliott Wave — Indexes &amp; Sectors</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Weekly wave counts on US indexes (QQQ, VOO, IWM), hot sectors (SMH, MU, XBI, XLE), and GLD — same engine as
            chart EW badges. Targets, ABC roadmaps, and curated pro EW links below.
          </p>
          <p className="mt-3 text-sm text-zinc-400">
            <a
              href="https://www.tradingview.com/chart/BTCUSD/xepjxoEQ-A-Comprehensive-Guide-to-Elliott-Wave-Rules-Guidelines/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-300 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-200"
            >
              Elliott Wave rules &amp; guidelines (TradingView)
            </a>{' '}
            — impulse and ABC rules the local engine follows.
          </p>
        </div>
        <ElliottWaveClient />
      </div>
    </main>
  );
}
