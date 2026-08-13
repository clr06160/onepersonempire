'use client';

import { useEffect, useState } from 'react';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type IndexBloom = {
  key: string;
  short: string;
  title: string;
  symbol: string;
  image: string;
  startYear: number;
  endYear: number;
  years: number;
  totalPct: number;
  cagrPct: number;
  volPct: number;
};

type IndexManifest = {
  generatedAt?: string;
  note?: string;
  items?: IndexBloom[];
};

function fmtPct(value: number, digits = 0) {
  const abs = Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  return `${value >= 0 ? '+' : '−'}${abs}%`;
}

function IndexFingerprints({ items }: { items: IndexBloom[] }) {
  if (!items.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950/30 via-zinc-950 to-zinc-950 p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">
        Indexes · full history
      </p>
      <h2 className="mt-2 text-xl font-semibold text-zinc-50">Market fingerprints</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        Seasonal blooms for the big indexes, as far back as the data goes — unique visual
        fingerprints of each market&apos;s life (a QR code that decided to look cool).
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <figure
            key={item.key}
            className="overflow-hidden rounded-2xl border border-zinc-800 bg-black/80 p-3"
          >
            <div className="aspect-square overflow-hidden rounded-xl bg-zinc-950">
              <img src={item.image} alt={`${item.short} bloom`} className="h-full w-full object-cover" />
            </div>
            <figcaption className="mt-3 text-center">
              <div className="text-sm font-bold tracking-[0.18em] text-zinc-100">{item.short}</div>
              <div className="mt-1 text-xs text-zinc-500">
                {item.title} · {item.startYear}–{item.endYear}
              </div>
              <div className="mt-1 font-mono text-[11px] text-violet-200/90">
                {item.years}y · {fmtPct(item.totalPct)} · {fmtPct(item.cagrPct, 1)}/yr · {item.volPct}% vol
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/**
 * Price as Art — index fingerprints (React, durable) + scanner-pick wall (static iframe from
 * art_lab publish). Index assets live under /public/gallery/indexes so pick-wall republishes
 * do not prune them.
 */
export default function GalleryClient() {
  const [indexes, setIndexes] = useState<IndexBloom[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/gallery/indexes/manifest.json', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as IndexManifest;
        if (!cancelled) setIndexes(payload.items || []);
      } catch {
        // optional section
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-[1400px]">
      <ScannerExtrasNav active="/scanner/gallery" />
      <IndexFingerprints items={indexes} />
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
        <iframe
          src="/gallery/index.html"
          title="Price as Art"
          className="h-[88vh] w-full border-0"
        />
      </div>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Index fingerprints above, then every name currently live in the scanners. Click any pick
        tile for its full gallery. Open the pick wall directly:{' '}
        <a className="text-emerald-400 hover:underline" href="/gallery/index.html" target="_blank" rel="noreferrer">
          /gallery/index.html
        </a>
        .
      </p>
    </div>
  );
}
