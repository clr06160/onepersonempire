import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { buildScannerDownloadZip } from '@/lib/scanner-download';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

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
    const message = toScannerUserMessage(error, 'Could not build scanner download.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
