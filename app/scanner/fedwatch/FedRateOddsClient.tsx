'use client';

import { useCallback, useEffect, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import { formatMeetingDate, rateLean, type FedWatchMeeting, type FedWatchPayload } from '@/lib/fedwatch-utils';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  return `${Number(value).toFixed(0)}%`;
}

function ProbBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const width = Math.max(0, Math.min(100, value));
  const barColor =
    tone === 'hike' ? 'bg-amber-500' : tone === 'cut' ? 'bg-emerald-500' : 'bg-zinc-500';
  const textColor =
    tone === 'hike' ? 'text-amber-200' : tone === 'cut' ? 'text-emerald-200' : 'text-zinc-300';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="uppercase tracking-wide text-zinc-500">{label}</span>
        <span className={`font-semibold ${textColor}`}>{pct(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: FedWatchMeeting }) {
  const lean = rateLean(meeting);
  const hike = Number(meeting.probabilities?.hike25 ?? 0);
  const hold = Number(meeting.probabilities?.hold ?? 0);
  const cut = Number(meeting.probabilities?.cut25 ?? 0);

  const leanTone =
    lean?.tone === 'hike'
      ? 'border-amber-600/70 bg-amber-950/50 text-amber-200'
      : lean?.tone === 'cut'
        ? 'border-emerald-600/70 bg-emerald-950/50 text-emerald-200'
        : 'border-zinc-700 bg-zinc-900 text-zinc-300';

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">{formatMeetingDate(meeting.meetingDate)}</h3>
          <p className="text-xs text-zinc-500">FOMC meeting{meeting.contract ? ` · ${meeting.contract}` : ''}</p>
        </div>
        {lean ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${leanTone}`}>
            {lean.direction === 'hold' ? 'Hold favored' : `${lean.label} ${pct(lean.prob)}`}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <ProbBar label="Cut" value={cut} tone="cut" />
        <ProbBar label="Hold" value={hold} tone="hold" />
        <ProbBar label="Hike" value={hike} tone="hike" />
      </div>

      {meeting.buckets?.length ? (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="mb-1 text-[11px] uppercase tracking-wide text-zinc-600">Target range odds</p>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
            {meeting.buckets.map((bucket) => (
              <span key={bucket.range} className="rounded border border-zinc-800 px-2 py-0.5">
                {bucket.range}: <span className="text-zinc-200">{pct(bucket.probability)}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function FedRateOddsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<FedWatchPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/fedwatch', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load Fed rate odds.');
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

  const meetings = data?.meetings || [];
  const policy = data?.policy;

  return (
    <>
      <ScannerExtrasNav active="/scanner/fedwatch" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading rate odds...</section>
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
              <h2 className="text-2xl font-semibold">Upcoming FOMC meetings</h2>
              {policy ? (
                <p className="text-sm text-zinc-400">
                  Current target {policy.targetLabel || 'n/a'}
                  {policy.effectiveRate != null ? ` · effective ${policy.effectiveRate}%` : ''}
                </p>
              ) : null}
              <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
            </div>
            {data?.generatedAt ? (
              <span className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
            ) : null}
          </div>

          {error ? <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}

          {data?.message && !meetings.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          {meetings.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {meetings.map((meeting) => (
                <MeetingCard key={meeting.meetingDate} meeting={meeting} />
              ))}
            </div>
          ) : null}

          {data?.note ? <p className="mt-6 text-xs text-zinc-600">{data.note}</p> : null}
          {data?.officialToolUrl ? (
            <p className="mt-2 text-xs text-zinc-600">
              Methodology reference:{' '}
              <a href={data.officialToolUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300">
                CME FedWatch
              </a>
            </p>
          ) : null}
        </section>
      )}
    </>
  );
}
