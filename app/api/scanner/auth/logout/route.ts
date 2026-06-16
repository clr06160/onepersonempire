import { NextResponse } from 'next/server';
import { clearScannerSession } from '@/lib/scanner-auth';

export const runtime = 'nodejs';

export async function POST() {
  await clearScannerSession();
  return NextResponse.json({ ok: true });
}
