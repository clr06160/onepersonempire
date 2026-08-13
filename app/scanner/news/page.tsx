import NewsClient from './NewsClient';

export const dynamic = 'force-dynamic';

export default function ScannerNewsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner · extras</p>
          <h1 className="text-4xl font-bold tracking-tight">News &amp; Catalysts</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Latest headlines for the names your systems are surfacing right now. Each item shows the
            publisher, a snippet, and a keyword-derived catalyst tag so you can see why a pick is moving.
            Sourced from a licensed provider, so this feed is limited to the owner account.
          </p>
        </div>
        <NewsClient />
      </div>
    </main>
  );
}
