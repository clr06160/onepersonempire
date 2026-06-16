import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { listScannerDownloadSummary } from '@/lib/scanner-download';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Developer access required.' }, { status: 403 });
  }

  try {
    const summary = await listScannerDownloadSummary();
    return NextResponse.json({
      user,
      ...summary,
      message: `Download a zip with ${summary.scannerCount} scanner files plus shared Python modules.`,
      downloadUrl: '/api/scanner/developer/download',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Developer tools unavailable.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
