import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadCotReportData } from '@/lib/scanner-cot-data';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadCotReportData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load COT report data.';
    return NextResponse.json({ user, data: { connected: false, message, equities: [] } });
  }
}
