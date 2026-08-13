import IpoShortClient from './IpoShortClient';

export const dynamic = 'force-dynamic';

export default function IpoShortPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-3xl border border-rose-800/40 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.16),transparent_35%),linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.98))] p-7 shadow-2xl sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-rose-400">
            Private scanner · research sleeve
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Shorting IPOs</h1>
          <p className="mt-4 max-w-4xl text-base leading-7 text-zinc-300">
            Many IPOs drift lower over the first six months. The aggregate short edge is real — but
            stops mostly kill it, and one melt-up can wreck normal size. Read the study, then size tiny
            if you run the sleeve.
          </p>
        </header>
        <IpoShortClient />
      </div>
    </main>
  );
}
