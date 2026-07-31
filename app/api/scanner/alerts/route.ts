import { NextResponse } from 'next/server';

import {
  getAlertPrefs,
  saveAlertPrefs,
  validateAlertPrefsInput,
} from '@/lib/scanner-alert-prefs';
import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

export async function GET() {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  try {
    const prefs = await getAlertPrefs(user.email);
    return NextResponse.json({ user, prefs });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not load alert preferences.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireScannerSession();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const validated = validateAlertPrefsInput(body);
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  try {
    const prefs = await saveAlertPrefs(user.email, validated.value);
    return NextResponse.json({
      prefs,
      message: prefs.enabled
        ? 'Alert preferences saved. You will get email when PowerTrend flips, the book changes, or cash brake arms.'
        : 'Alerts turned off. Preferences saved.',
    });
  } catch (error) {
    const message = toScannerUserMessage(error, 'Could not save alert preferences.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
