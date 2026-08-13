'use client';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

const INDEX_BLOOMS = [
  {
    key: 'DOW',
    short: 'DOW',
    title: 'Dow Jones',
    image: '/gallery/indexes/DOW_bloom.webp',
    startYear: 1992,
    endYear: 2026,
    years: 34.6,
    totalPct: 1597.1,
    cagrPct: 8.5,
    volPct: 17,
  },
  {
    key: 'SPX',
    short: 'SPY',
    title: 'S&P 500',
    image: '/gallery/indexes/SPX_bloom.webp',
    startYear: 1927,
    endYear: 2026,
    years: 98.6,
    totalPct: 44061.9,
    cagrPct: 6.4,
    volPct: 19,
  },
  {
    key: 'NDX',
    short: 'QQQ',
    title: 'Nasdaq-100',
    image: '/gallery/indexes/NDX_bloom.webp',
    startYear: 1985,
    endYear: 2026,
    years: 40.9,
    totalPct: 26727.6,
    cagrPct: 14.7,
    volPct: 26,
  },
  {
    key: 'RUT',
    short: 'IWM',
    title: 'Russell 2000',
    image: '/gallery/indexes/RUT_bloom.webp',
    startYear: 1987,
    endYear: 2026,
    years: 38.9,
    totalPct: 1706.7,
    cagrPct: 7.7,
    volPct: 22,
  },
] as const;

function fmtPct(value: number, digits = 0) {
  const abs = Math.abs(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
  return `${value >= 0 ? '+' : '−'}${abs}%`;
}

/**
 * Price as Art — index fingerprints above the scanner-pick wall.
 * Index assets live under /public/gallery/indexes (and are also inlined at the
 * top of /gallery/index.html) so they show both in the app chrome and inside
 * the art iframe.
 */
export default function GalleryClient() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <ScannerExtrasNav active="/scanner/gallery" />

      <section className="mb-6 rounded-2xl border border-violet-900/40 bg-gradient-to-br from-violet-950/30 via-zinc-950 to-zinc-950 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">
          Indexes · full history
        </p>
        <h2 className="mt-2 text-xl font-semibold text-zinc-50">Market fingerprints</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
          Seasonal blooms for the big indexes, as far back as the data goes — unique visual
          fingerprints of each market&apos;s life.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {INDEX_BLOOMS.map((item) => (
            <figure
              key={item.key}
              className="overflow-hidden rounded-2xl border border-zinc-800 bg-black/80 p-3"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-zinc-950">
                <img
                  src={item.image}
                  alt={`${item.short} bloom`}
                  className="h-full w-full object-cover"
                />
              </div>
              <figcaption className="mt-3 text-center">
                <div className="text-sm font-bold tracking-[0.18em] text-zinc-100">{item.short}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  {item.title} · {item.startYear}–{item.endYear}
                </div>
                <div className="mt-1 font-mono text-[11px] text-violet-200/90">
                  {item.years}y · {fmtPct(item.totalPct)} · {fmtPct(item.cagrPct, 1)}/yr · {item.volPct}%
                  vol
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
        <iframe
          src="/gallery/index.html"
          title="Price as Art"
          className="h-[88vh] w-full border-0"
        />
      </div>
      <p className="mt-4 text-center text-sm text-zinc-400">
        Index fingerprints above and at the top of the wall. Click any pick tile for its full
        gallery. Open the wall directly:{' '}
        <a
          className="text-emerald-400 hover:underline"
          href="/gallery/index.html"
          target="_blank"
          rel="noreferrer"
        >
          /gallery/index.html
        </a>
        .
      </p>
    </div>
  );
}
