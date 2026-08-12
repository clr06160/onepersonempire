import ScannerWaitlistClient from './ScannerWaitlistClient';

export const dynamic = 'force-dynamic';

export default function ScannerWaitlistPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <ScannerWaitlistClient />
      </div>
    </main>
  );
}
