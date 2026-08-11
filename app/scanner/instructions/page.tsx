import ScannerInstructionsClient from './ScannerInstructionsClient';

export const dynamic = 'force-dynamic';

export default function ScannerInstructionsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Dream Tree</p>
          <h1 className="text-4xl font-bold tracking-tight">How to use the desk</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Start with Day 1 below. Deeper system notes for each scan live further down the page.
          </p>

          <section className="mt-8 rounded-2xl border border-cyan-800/50 bg-cyan-950/25 p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400">Day 1 · first 2 minutes</p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6 text-zinc-200">
              <li>
                Open{' '}
                <a href="/scanner/leaders" className="font-semibold text-cyan-300 hover:text-cyan-200">
                  Leaders
                </a>
                . Themes at the top are beating QQQ hardest (RS63 = beat QQQ by that many percentage points).
              </li>
              <li>
                <span className="font-semibold text-zinc-50">Click a theme</span> to open its roster. Review names by
                RS; sales/EPS are for judgment.
              </li>
              <li>
                Check{' '}
                <a href="/scanner/cockpit" className="font-semibold text-amber-300 hover:text-amber-200">
                  Flight Deck
                </a>{' '}
                for today&apos;s book, or{' '}
                <a href="/scanner?systems=1" className="font-semibold text-emerald-300 hover:text-emerald-200">
                  System scanner
                </a>{' '}
                for the ranked warehouse behind it.
              </li>
              <li>
                Confirm a ticker on{' '}
                <a href="/scanner/charts" className="font-semibold text-zinc-100 hover:text-white">
                  Charts
                </a>
                .
              </li>
            </ol>
            <p className="mt-4 text-xs text-zinc-500">
              Colored nav buttons (Leaders · Flight Deck · System scanner) are the main desk. Charts and Instructions
              are supporting.
            </p>
          </section>
        </div>
        <ScannerInstructionsClient />
      </div>
    </main>
  );
}
