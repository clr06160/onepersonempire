import CoreDeskClient from './CoreDeskClient';

export const dynamic = 'force-dynamic';

export default function CoreDeskPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <CoreDeskClient />
      </div>
    </main>
  );
}
