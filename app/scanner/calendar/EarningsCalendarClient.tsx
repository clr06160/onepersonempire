'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type {
  EarningsCalendarDay,
  EarningsCalendarPayload,
  EarningsCalendarStock,
} from '@/lib/scanner-earnings-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const fixed = Number(value).toFixed(1);
  return `${Number(value) > 0 ? '+' : ''}${fixed}%`;
}

function moveClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-500';
  if (value >= 10) return 'text-emerald-300 font-semibold';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-400';
}

function scoreClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'border-zinc-700 bg-zinc-900 text-zinc-400';
  if (value >= 5) return 'border-amber-600/70 bg-amber-950/60 text-amber-200';
  if (value >= 3) return 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function formatDateHeading(day: EarningsCalendarDay) {
  const weekday = day.weekday || '';
  let pretty = day.date;
  const parsed = new Date(`${day.date}T00:00:00`);
  if (!Number.isNaN(parsed.getTime())) {
    pretty = parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return { weekday, pretty };
}

function timeBadgeClass(label?: string) {
  if (label === 'Before open') return 'border-sky-700/60 bg-sky-950/50 text-sky-200';
  if (label === 'After close') return 'border-violet-700/60 bg-violet-950/50 text-violet-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function StockRow({ stock }: { stock: EarningsCalendarStock }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <div className="min-w-[200px]">
        <div className="flex items-center gap-2">
          <TickerLink ticker={stock.ticker} className="text-base font-semibold text-emerald-200" />
          {stock.timeLabel ? (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${timeBadgeClass(stock.timeLabel)}`}>
              {stock.timeLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 text-sm text-zinc-400">{stock.company || '—'}</div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-zinc-500">
          {stock.sector ? <span>{stock.sector}</span> : null}
          {(stock.universes || []).map((universe) => (
            <span key={universe} className="rounded border border-zinc-800 px-1.5 py-0.5">
              {universe}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="text-right">
          <div className={`text-sm ${moveClass(stock.immediateReactionPct)}`}>{pct(stock.immediateReactionPct)}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Last immediate</div>
        </div>
        <div className="text-right">
          <div className={`text-sm ${moveClass(stock.threeDayReactionPct)}`}>{pct(stock.threeDayReactionPct)}</div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-600">Last 3-day</div>
        </div>
        <div className="text-right">
          <span className={`inline-flex min-w-[2rem] justify-center rounded-md border px-2 py-1 text-sm font-bold ${scoreClass(stock.earningsReactionScore)}`}>
            {stock.earningsReactionScore ?? '—'}
          </span>
          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">React score</div>
        </div>
      </div>
    </div>
  );
}

export default function EarningsCalendarClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<EarningsCalendarPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/calendar', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load the earnings calendar.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData(payload.data || null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const days = useMemo(() => data?.days || [], [data]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/calendar" />

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
              <h2 className="text-2xl font-semibold">Upcoming reports — strong reactors</h2>
              <p className="text-sm text-zinc-400">
                {data?.criteria || 'Strong reactors'} · {data?.totalCount ?? 0} names through{' '}
                {data?.windowEnd || 'n/a'}
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
              No upcoming earnings for strong reactors in the current window.
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
                      {day.count ?? day.stocks.length} {(day.count ?? day.stocks.length) === 1 ? 'name' : 'names'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {day.stocks.map((stock) => (
                      <StockRow key={`${day.date}-${stock.ticker}`} stock={stock} />
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
