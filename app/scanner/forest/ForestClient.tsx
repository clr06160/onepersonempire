'use client';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

/**
 * The Forest — each scanner universe (IWM / QQQ / MidCap / SPY) rendered as a grid of leaves,
 * one per current pick, colored by health and shaped by growth character. The page is a
 * self-contained static asset published to /public/forest by the stocks repo
 * (art_lab/build_scanner_art.py + publish_scanner_art.py); the universe tabs live inside it.
 */
export default function ForestClient() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <ScannerExtrasNav active="/scanner/forest" />
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
        <iframe
          src="/forest/forest.html"
          title="The Forest"
          className="h-[88vh] w-full border-0"
        />
      </div>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Each leaf is one of the scanner&apos;s current picks; color is health, shape is its growth
        character, and the notches are the dips it took along the way. Toggle{' '}
        <span className="text-zinc-200">IWM / QQQ / MidCap / SPY</span> to switch universes. Open
        directly to share:{' '}
        <a className="text-emerald-400 hover:underline" href="/forest/forest.html" target="_blank" rel="noreferrer">
          /forest/forest.html
        </a>
        .
      </p>
    </div>
  );
}
