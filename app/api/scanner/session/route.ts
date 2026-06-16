import { NextResponse } from 'next/server';
import { getScannerSession } from '@/lib/scanner-auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getScannerSession();
  return NextResponse.json({ user });
}
