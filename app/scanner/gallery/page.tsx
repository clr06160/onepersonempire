import GalleryClient from './GalleryClient';

export const dynamic = 'force-dynamic';

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · extras</p>
          <h1 className="text-4xl font-bold tracking-tight">Price as Art</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            The scanner&apos;s current picks, each turned into a set of evocative shapes — its bloom,
            heartbeat, growth rings, dusk mountains, constellation, record-of-time spiral and leaf.
            Click any name to open its full gallery.
          </p>
        </div>
        <GalleryClient />
      </div>
    </main>
  );
}
