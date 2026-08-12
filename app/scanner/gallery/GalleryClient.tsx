'use client';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

/**
 * Price as Art — a wall of the scanner's current picks, each rendered as a set of evocative
 * shapes (bloom, heartbeat, rings, mountains, constellation, spiral, leaf). Clicking a tile
 * opens that ticker's full gallery. Static assets published to /public/gallery by the stocks
 * repo (art_lab/build_scanner_art.py + publish_scanner_art.py); the set auto-prunes as picks
 * rotate out of the scanners.
 */
export default function GalleryClient() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <ScannerExtrasNav active="/scanner/gallery" />
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
        <iframe
          src="/gallery/index.html"
          title="Price as Art"
          className="h-[88vh] w-full border-0"
        />
      </div>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Every name currently live in the scanners, rendered as price-as-art. Click any tile to open
        its full gallery. Open directly to share:{' '}
        <a className="text-emerald-400 hover:underline" href="/gallery/index.html" target="_blank" rel="noreferrer">
          /gallery/index.html
        </a>
        .
      </p>
    </div>
  );
}
