import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession('developer');
  if (!user) {
    return NextResponse.json({ error: 'Developer access required.' }, { status: 403 });
  }

  return NextResponse.json({
    user,
    downloadsEnabled: false,
    message:
      'Developer login is working. Next step is packaging a safe Python download without secrets, cache files, or API keys.',
  });
}
