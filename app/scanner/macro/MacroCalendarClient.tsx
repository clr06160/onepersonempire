'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type { MacroCalendarDay, MacroCalendarPayload, MacroEvent } from '@/lib/scanner-macro-data';
import { rateLean, type FedWatchPayload, type RateLean } from '@/lib/fedwatch-utils';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function categoryClass(category?: string) {
  switch (category) {
    case 'fed':
      return 'border-amber-600/70 bg-amber-950/60 text-amber-200';
    case 'inflation':
      return 'border-rose-700/60 bg-rose-950/50 text-rose-200';
    case 'jobs':
      return 'border-sky-700/60 bg-sky-950/50 text-sky-200';
    case 'growth':
      return 'border-emerald-700/60 bg-emerald-950/50 text-emerald-200';
    case 'consumer':
      return 'border-violet-700/60 bg-violet-950/50 text-violet-200';
    default:
      return 'border-zinc-700 bg-zinc-900 text-zinc-300';
  }
}

function importanceDot(importance?: string) {
  if (importance === 'high') return 'bg-red-400';
  if (importance === 'medium') return 'bg-amber-400';
  return 'bg-zinc-500';
}

function formatDateHeading(day: MacroCalendarDay) {
  const weekday = day.weekday || '';
  let pretty = day.date;
  const parsed = new Date(`${day.date}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    pretty = parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return { weekday, pretty };
}

function leanBadgeClass(tone: RateLean['tone']) {
  if (tone === 'hike') return 'border-amber-600/70 bg-amber-950/60 text-amber-200';
  if (tone === 'cut') return 'border-emerald-600/70 bg-emerald-950/60 text-emerald-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function EventRow({ event, lean }: { event: MacroEvent; lean?: RateLean | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className={`h-2 w-2 flex-none rounded-full ${importanceDot(event.importance)}`} title={`${event.importance || ''} importance`} />
        <span className="text-base font-semibold text-zinc-100">{event.name}</span>
      </div>
      <div className="flex items-center gap-2">
        {lean ? (
          <a
            href="/scanner/fedwatch"
            title="Market-implied odds for this meeting"
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition hover:brightness-110 ${leanBadgeClass(lean.tone)}`}
          >
            {lean.tone === 'hike' ? '↑ ' : lean.tone === 'cut' ? '↓ ' : ''}
            {lean.direction === 'hold' ? `Hold ${lean.prob.toFixed(0)}%` : `${lean.label} ${lean.prob.toFixed(0)}%`}
          </a>
        ) : null}
        {event.category ? (
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${categoryClass(event.category)}`}>
            {event.category}
          </span>
        ) : null}
        {event.source ? <span className="text-[11px] text-zinc-600">{event.source}</span> : null}
      </div>
    </div>
  );
}

export default function MacroCalendarClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<MacroCalendarPayload | null>(null);
  const [fedwatch, setFedwatch] = useState<FedWatchPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [response, fedResponse] = await Promise.all([
      fetch('/api/scanner/macro', fetchInit),
      fetch('/api/scanner/fedwatch', fetchInit),
    ]);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load the macro calendar.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData(payload.data || null);
    if (fedResponse.ok) {
      const fedPayload = await fedResponse.json();
      setFedwatch(fedPayload.data || null);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const days = useMemo(() => data?.days || [], [data]);

  const leanByDate = useMemo(() => {
    const map = new Map<string, RateLean>();
    for (const meeting of fedwatch?.meetings || []) {
      const lean = rateLean(meeting);
      if (meeting.meetingDate && lean) map.set(meeting.meetingDate, lean);
    }
    return map;
  }, [fedwatch]);

  const leanForEvent = useCallback(
    (date: string, event: MacroEvent) =>
      event.category === 'fed' && /fomc|rate decision/i.test(event.name) ? leanByDate.get(date) || null : null,
    [leanByDate],
  );

  return (
    <>
      <ScannerExtrasNav active="/scanner/macro" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading calendar...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Upcoming macro events</h2>
              <p className="text-sm text-zinc-400">
                {data?.totalCount ?? 0} releases through {data?.windowEnd || 'n/a'}
              </p>
              <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
            </div>
            {data?.generatedAt ? (
              <span className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
            ) : null}
          </div>

          {error ? <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}

          {data?.message && !days.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          {!days.length && !data?.message ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-400">
              No macro events in the current window.
            </p>
          ) : null}

          <div className="space-y-6">
            {days.map((day) => {
              const { weekday, pretty } = formatDateHeading(day);
              return (
                <div key={day.date}>
                  <div className="mb-2 flex items-baseline gap-2 border-b border-zinc-800 pb-2">
                    <h3 className="text-lg font-semibold text-zinc-100">{pretty}</h3>
                    {weekday ? <span className="text-sm text-zinc-500">{weekday}</span> : null}
                    <span className="ml-auto text-xs text-zinc-500">
                      {day.count ?? day.events.length} {(day.count ?? day.events.length) === 1 ? 'event' : 'events'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {day.events.map((event, index) => (
                      <EventRow
                        key={`${day.date}-${event.name}-${index}`}
                        event={event}
                        lean={leanForEvent(day.date, event)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {data?.note ? <p className="mt-6 text-xs text-zinc-600">{data.note}</p> : null}
        </section>
      )}
    </>
  );
}
