import { NextResponse } from 'next/server';
import { requireScannerSession } from '@/lib/scanner-auth';
import { loadAdaptiveMonitorData } from '@/lib/scanner-adaptive-monitor-data';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const data = await loadAdaptiveMonitorData();
    return NextResponse.json({ user, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load adaptive monitor data.';
    return NextResponse.json({
      user,
      data: { connected: false, message, insights: { active: [] }, learningLog: [] },
    });
  }
}
