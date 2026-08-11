import RawBearClient from './RawBearClient';

export const dynamic = 'force-dynamic';

export default function RawBearPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-gradient-to-br from-red-950/30 via-zinc-900/80 to-zinc-950 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-red-400">
            Private scanner · defense sleeve
          </p>
          <h1 className="text-4xl font-bold tracking-tight">Raw Bear</h1>
          <p className="mt-3 max-w-3xl text-zinc-300">
            Mirror of Daily Raw bullish momentum — bottom 10 names with{' '}
            <span className="text-red-300">negative 21d and 63d momentum</span> per universe. These are{' '}
            <span className="text-red-300">falling</span> names (radar for defense), not stocks you are long. Forward
            test simulates short returns only.
          </p>
        </div>
        <RawBearClient />
      </div>
    </main>
  );
}
