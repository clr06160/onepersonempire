import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

import { buildCurrentAlertSnapshot, dispatchScannerAlerts, resolveBookDelta } from '@/lib/scanner-alert-dispatch';
import { formatAlertEmail, isAlertMailConfigured, sendAlertEmail } from '@/lib/scanner-alert-mail';
import { getAlertPrefs } from '@/lib/scanner-alert-prefs';
import { loadSignalSnapshot, writeAlertOutbox } from '@/lib/scanner-alert-store';
import { loadCockpitForward } from '@/lib/scanner-cockpit-forward';
import { requireScannerSession } from '@/lib/scanner-auth';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

export const runtime = 'nodejs';

function dispatchSecret() {
  return (
    process.env.SCANNER_ALERTS_DISPATCH_SECRET?.trim() ||
    process.env.SCANNER_AUTH_SECRET?.trim() ||
    ''
  );
}

function authorizedBySecret(req: Request) {
  const expected = dispatchSecret();
  if (!expected) return false;
  const header = req.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const alt = req.headers.get('x-scanner-alerts-secret')?.trim() || '';
  const given = bearer || alt;
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    test?: boolean;
  };

  const sessionUser = await requireScannerSession();
  const secretOk = authorizedBySecret(req);

  if (!sessionUser && !secretOk) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  }

  // Interactive test from Flight Deck — always targets the signed-in user's alert email.
  if (body.test) {
    if (!sessionUser) {
      return NextResponse.json({ error: 'Sign in to send a test alert.' }, { status: 401 });
    }

    let step = 'start';
    try {
      step = 'prefs';
      const prefs = await getAlertPrefs(sessionUser.email);
      if (!prefs.email?.includes('@')) {
        return NextResponse.json({
          user: sessionUser,
          result: {
            emailed: 0,
            failed: 1,
            mailConfigured: isAlertMailConfigured(),
            message: 'Save a valid alert email on Flight Deck, then retry the test.',
          },
        });
      }

      step = 'snapshot';
      let snapshot = {
        asOf: new Date().toISOString().slice(0, 10),
        bookTickers: [] as string[],
        cashBrake: false,
        powerTrendOn: false,
      };
      try {
        snapshot = await buildCurrentAlertSnapshot();
      } catch (snapshotError) {
        console.error('[alerts/dispatch] test snapshot failed', snapshotError);
      }

      step = 'format';
      const previous = await loadSignalSnapshot().catch(() => null);
      const forward = await loadCockpitForward().catch(() => ({ trades: [] }));
      const { added: addedTickers, removed: removedTickers } = resolveBookDelta(
        forward,
        previous?.bookTickers,
        snapshot.bookTickers,
      );

      const { subject, text, html } = formatAlertEmail({
        events: [
          {
            title: 'Test alert',
            detail: 'Preview of your Flight Deck alert layout.',
          },
        ],
        asOf: snapshot.asOf,
        bookTickers: snapshot.bookTickers,
        addedTickers,
        removedTickers,
        cashBrake: snapshot.cashBrake,
        powerTrendOn: snapshot.powerTrendOn,
        powerTrendLabel:
          'powerTrendLabel' in snapshot
            ? String((snapshot as { powerTrendLabel?: string }).powerTrendLabel || '')
            : undefined,
        totalReturnPct:
          'totalReturnPct' in snapshot &&
          typeof (snapshot as { totalReturnPct?: number }).totalReturnPct === 'number'
            ? (snapshot as { totalReturnPct?: number }).totalReturnPct
            : undefined,
      });

      if (!isAlertMailConfigured()) {
        step = 'outbox-skip';
        try {
          await writeAlertOutbox({
            to: prefs.email,
            subject,
            body: text,
            events: ['bookChange'],
            status: 'skipped',
            error: 'Mail provider not configured.',
          });
        } catch (outboxError) {
          console.error('[alerts/dispatch] outbox skip write failed', outboxError);
        }
        return NextResponse.json({
          user: sessionUser,
          result: {
            emailed: 0,
            failed: 1,
            mailConfigured: false,
            message:
              'Email provider is not configured yet. Set RESEND_API_KEY on Cloud Run for alerts@dreamtreestocks.com (or Gmail SMTP as fallback).',
          },
        });
      }

      step = 'send';
      const sent = await sendAlertEmail({ to: prefs.email, subject, text, html });

      step = 'outbox';
      try {
        await writeAlertOutbox({
          to: prefs.email,
          subject,
          body: text,
          events: ['bookChange'],
          status: sent.ok ? 'sent' : 'failed',
          error: sent.error,
        });
      } catch (outboxError) {
        // Don't fail the user-visible send just because audit log write failed.
        console.error('[alerts/dispatch] outbox write failed', outboxError);
      }

      return NextResponse.json({
        user: sessionUser,
        result: {
          emailed: sent.ok ? 1 : 0,
          failed: sent.ok ? 0 : 1,
          mailConfigured: true,
          provider: sent.provider,
          message: sent.ok
            ? `Test alert sent to ${prefs.email}.`
            : sent.error || 'Could not send test alert.',
        },
      });
    } catch (error) {
      console.error('[alerts/dispatch] test alert failed', { step, error });
      const raw = error instanceof Error ? error.message : String(error);
      const message =
        toScannerUserMessage(error, '') ||
        (raw && raw.length < 180 ? raw : '') ||
        `Could not send test alert (step: ${step}).`;
      return NextResponse.json({ error: message, step }, { status: 500 });
    }
  }

  // Automated dispatch from PC upload job (secret) or developer session.
  if (!secretOk && sessionUser?.role !== 'developer') {
    return NextResponse.json({ error: 'Not authorized to dispatch alerts.' }, { status: 403 });
  }

  try {
    const result = await dispatchScannerAlerts();
    return NextResponse.json({ result });
  } catch (error) {
    console.error('[alerts/dispatch] dispatch failed', error);
    const message = toScannerUserMessage(error, 'Could not dispatch alerts.');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
