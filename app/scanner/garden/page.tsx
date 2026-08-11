import GardenClient from './GardenClient';

export const dynamic = 'force-dynamic';

export default function GardenPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <GardenClient />
      </div>
    </main>
  );
}
