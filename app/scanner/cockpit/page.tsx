import ScannerCockpitClient from './ScannerCockpitClient';

export const dynamic = 'force-dynamic';

export default function ScannerCockpitPage() {
  return (
    <main className="cockpit-page min-h-screen px-4 py-8 text-amber-50 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <ScannerCockpitClient />
      </div>
    </main>
  );
}
