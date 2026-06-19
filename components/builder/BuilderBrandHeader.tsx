'use client';

export function BuilderBrandHeader() {
  return (
    <div className="border-b border-zinc-800 bg-black">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-x-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-white">OPE</div>
          <h1 className="text-4xl font-bold tracking-tighter">OnePerson Empire</h1>
        </div>
        <p className="hidden text-lg font-medium text-zinc-400 md:block">
          Build a shop - Customize the vibe - Get paid
        </p>
        <div className="flex items-center gap-x-4">
          <div className="flex items-center gap-x-1 rounded-3xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live AI
          </div>
        </div>
      </div>
    </div>
  );
}
