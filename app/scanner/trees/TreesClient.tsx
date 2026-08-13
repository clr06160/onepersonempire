'use client';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

/**
 * Market Trees — the interactive "stocks as one living canopy" pages.
 * These are self-contained static pages published to /public/trees by the stocks repo
 * (art_lab/publish_trees.py). We frame them inside the scanner shell; the embedded page
 * carries its own universe nav (NASDAQ-100 / S&P 500 / MidCap / Russell), year scrubber,
 * Play movie, and the Rankings toggle.
 */
export default function TreesClient() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <ScannerExtrasNav active="/scanner/trees" />
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
        <iframe
          src="/trees/tree.html"
          title="Market Trees"
          className="h-[88vh] w-full border-0"
        />
      </div>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Each leaf is a stock; the canopy is colored by return. Pick a year or hit{' '}
        <span className="text-zinc-200">Play</span> to scrub through market history, and toggle{' '}
        <span className="text-zinc-200">Rankings</span> to strip the tree and rank every name for
        the selected year. Open any page directly to share:{' '}
        <a className="text-emerald-400 hover:underline" href="/trees/tree.html" target="_blank" rel="noreferrer">
          /trees/tree.html
        </a>
        .
      </p>
    </div>
  );
}
