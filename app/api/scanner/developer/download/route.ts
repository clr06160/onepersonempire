import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { buildScannerDownloadZip } from '@/lib/scanner-download';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Developer access required.' }, { status: 403 });
  }

  try {
    const { buffer, filename } = await buildScannerDownloadZip();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build scanner download.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
