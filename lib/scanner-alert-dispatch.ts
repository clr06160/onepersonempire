import { buildCockpitPayload } from '@/lib/scanner-cockpit';
import { missionBookTickers } from '@/lib/scanner-cockpit-knobs';
import { latestForwardBookDelta } from '@/lib/scanner-alert-book';
import { loadCockpitForward } from '@/lib/scanner-cockpit-forward';
import { formatAlertEmail, isAlertMailConfigured, sendAlertEmail } from '@/lib/scanner-alert-mail';
import {
  diffAlertEvents,
  diffBookTickers,
  listEnabledAlertPrefs,
  loadSignalSnapshot,
  saveSignalSnapshot,
  writeAlertOutbox,
  type AlertSignalSnapshot,
  type FiredAlertEvent,
} from '@/lib/scanner-alert-store';
import type { ScannerAlertEvents } from '@/lib/scanner-alert-prefs-types';

export type DispatchAlertsResult = {
  seeded: boolean;
  mailConfigured: boolean;
  events: FiredAlertEvent[];
  recipients: number;
  emailed: number;
  failed: number;
  snapshot: AlertSignalSnapshot;
  message: string;
};

export async function buildCurrentAlertSnapshot(): Promise<AlertSignalSnapshot> {
  const [cockpit, forward] = await Promise.all([buildCockpitPayload(), loadCockpitForward()]);
  const powerTrendOn = Boolean(cockpit.instruments?.powerTrendOn);

  // Match Flight Deck Mission book (default knobs) — not the shorter forward holdings list.
  const bookTickers = missionBookTickers(
    cockpit.book?.names || [],
    powerTrendOn,
    cockpit.book?.grossExposurePct ?? 100,
  );

  return {
    powerTrendOn,
    powerTrendLabel: String(cockpit.instruments?.powerTrend || ''),
    bookTickers,
    cashBrake: Boolean(forward.cashMode),
    monthKey: forward.monthKey ? String(forward.monthKey) : undefined,
    asOf: String(forward.asOf || cockpit.instruments?.scannerAsOf || cockpit.book?.asOf || ''),
    generatedAt: new Date().toISOString(),
    totalReturnPct:
      typeof forward.metrics?.totalReturnPct === 'number' && Number.isFinite(forward.metrics.totalReturnPct)
        ? forward.metrics.totalReturnPct
        : undefined,
  };
}

/** New / removed for email — prefer latest forward trade, else snapshot diff. */
export function resolveBookDelta(
  forward: Awaited<ReturnType<typeof loadCockpitForward>>,
  previousBook: string[] | null | undefined,
  currentBook: string[],
) {
  const bookSet = new Set(currentBook.map((t) => t.toUpperCase()));
  const trade = latestForwardBookDelta(forward);
  const tradeAdded = trade.added.filter((t) => bookSet.has(t));
  const tradeRemoved = trade.removed.filter(Boolean);

  if (tradeAdded.length || tradeRemoved.length) {
    return { added: tradeAdded, removed: tradeRemoved };
  }

  const diff = diffBookTickers(previousBook, currentBook);
  return { added: diff.added, removed: diff.removed };
}

function eventsForPrefs(events: FiredAlertEvent[], prefsEvents: ScannerAlertEvents) {
  return events.filter((event) => prefsEvents[event.id] !== false);
}

export async function dispatchScannerAlerts(opts?: {
  forceEvents?: FiredAlertEvent[];
  skipPersist?: boolean;
}): Promise<DispatchAlertsResult> {
  const current = await buildCurrentAlertSnapshot();
  const previous = await loadSignalSnapshot();
  const mailConfigured = isAlertMailConfigured();

  const events = opts?.forceEvents?.length ? opts.forceEvents : diffAlertEvents(previous, current);
  const seeded = !previous;

  if (!opts?.skipPersist) {
    await saveSignalSnapshot(current);
  }

  if (seeded && !opts?.forceEvents?.length) {
    return {
      seeded: true,
      mailConfigured,
      events: [],
      recipients: 0,
      emailed: 0,
      failed: 0,
      snapshot: current,
      message: 'Baseline signal snapshot saved. Alerts will fire on the next change.',
    };
  }

  if (!events.length) {
    return {
      seeded: false,
      mailConfigured,
      events: [],
      recipients: 0,
      emailed: 0,
      failed: 0,
      snapshot: current,
      message: 'No PowerTrend / book / cash-brake changes.',
    };
  }

  const recipients = await listEnabledAlertPrefs();
  let emailed = 0;
  let failed = 0;

  const forward = await loadCockpitForward();
  const { added: addedTickers, removed: removedTickers } = resolveBookDelta(
    forward,
    previous?.bookTickers,
    current.bookTickers,
  );

  for (const prefs of recipients) {
    const matched = eventsForPrefs(events, prefs.events);
    if (!matched.length) continue;

    const { subject, text, html } = formatAlertEmail({
      events: matched,
      asOf: current.asOf,
      bookTickers: current.bookTickers,
      addedTickers,
      removedTickers,
      cashBrake: current.cashBrake,
      powerTrendOn: current.powerTrendOn,
      powerTrendLabel: current.powerTrendLabel,
      totalReturnPct: current.totalReturnPct,
    });

    if (!mailConfigured) {
      await writeAlertOutbox({
        to: prefs.email,
        subject,
        body: text,
        events: matched.map((e) => e.id),
        status: 'skipped',
        error: 'Mail provider not configured.',
      });
      failed += 1;
      continue;
    }

    const result = await sendAlertEmail({ to: prefs.email, subject, text, html });
    await writeAlertOutbox({
      to: prefs.email,
      subject,
      body: text,
      events: matched.map((e) => e.id),
      status: result.ok ? 'sent' : 'failed',
      error: result.error,
    });
    if (result.ok) emailed += 1;
    else failed += 1;
  }

  return {
    seeded: false,
    mailConfigured,
    events,
    recipients: recipients.length,
    emailed,
    failed,
    snapshot: current,
    message: mailConfigured
      ? `Dispatched ${events.length} event(s) to ${emailed}/${recipients.length} recipient(s).`
      : `Detected ${events.length} event(s), but email provider is not configured on the server.`,
  };
}
