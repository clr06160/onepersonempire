import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadScannerInstructions } from '@/lib/scanner-instructions';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadScannerInstructions();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load scanner instructions.';
    return NextResponse.json({ user, data: { connected: false, message, systems: [] } });
  }
}
