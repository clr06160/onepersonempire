import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { listScannerDownloadSummary } from '@/lib/scanner-download';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

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
      message: `Download Python for code review (look-ahead bias, timing, methodology). Email findings back when done.`,
      downloadUrl: '/api/scanner/developer/download',
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Developer tools unavailable.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
