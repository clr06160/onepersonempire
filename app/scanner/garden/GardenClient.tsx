'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import type { DeskBriefPayload } from '@/lib/scanner-desk-brief';
import type { LeadersPayload } from '@/lib/scanner-leaders-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

type LeafPreview = {
  ticker: string;
  theme: string;
  stage?: string;
  note: string;
};

function stagePlain(stage?: string) {
  if (stage === 'Leading') return 'leading the pack right now';
  if (stage === 'Emerging') return 'waking up — early strength';
  if (stage === 'Extended') return 'already ran hard — watch for cooling';
  if (stage === 'Lagging') return 'behind the leaders';
  return 'on the board';
}

function moodFromBrief(brief?: DeskBriefPayload | null, leaders?: LeadersPayload | null) {
  const headline = brief?.headline?.trim();
  if (headline) return headline;
  const done =
    (leaders?.wave4Summary?.aboutDone || 0) + (leaders?.wave4Summary?.confirmedWave4 || 0);
  const riding = leaders?.wave4Summary?.riding || 0;
  if (done > 0 && done >= riding) {
    return 'Some leaders look tired — it’s okay to rest and watch.';
  }
  if (riding > 0) {
    return 'Leaders are still running — follow what’s growing, no homework required.';
  }
  return 'See what’s growing. Know when to rest.';
}

function buildLeaves(leaders?: LeadersPayload | null): LeafPreview[] {
  const rows = leaders?.microsectors || [];
  const out: LeafPreview[] = [];
  for (const ms of rows) {
    if (out.length >= 3) break;
    const ticker = (ms.leaders || [])[0];
    if (!ticker) continue;
    out.push({
      ticker,
      theme: ms.label || ms.key,
      stage: ms.stage,
      note: stagePlain(ms.stage),
    });
  }
  return out;
}

export default function GardenClient() {
  const [leaders, setLeaders] = useState<LeadersPayload | null>(null);
  const [brief, setBrief] = useState<DeskBriefPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [postcardBusy, setPostcardBusy] = useState(false);
  const [postcardMsg, setPostcardMsg] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [leadersRes, briefRes] = await Promise.all([
      fetch('/api/scanner/leaders', fetchInit),
      fetch('/api/scanner/desk-brief', fetchInit),
    ]);
    if (!leadersRes.ok) {
      const payload = await leadersRes.json().catch(() => ({}));
      setError(payload.error || payload.message || 'Could not load today’s garden.');
      return;
    }
    const leadersJson = await leadersRes.json();
    setLeaders((leadersJson.data || leadersJson) as LeadersPayload);
    if (briefRes.ok) {
      const briefJson = await briefRes.json();
      setBrief((briefJson.data || briefJson) as DeskBriefPayload);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const leaves = buildLeaves(leaders);
  const mood = moodFromBrief(brief, leaders);
  const asOf = leaders?.asOf || brief?.asOf || '—';

  async function optInPostcard() {
    setPostcardBusy(true);
    setPostcardMsg('');
    try {
      const sessionRes = await fetch('/api/scanner/session', fetchInit);
      const session = sessionRes.ok ? await sessionRes.json() : null;
      const email = session?.user?.email;
      if (!email) {
        setPostcardMsg('Sign in again to save postcard prefs.');
        return;
      }
      const res = await fetch('/api/scanner/alerts', {
        ...fetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          enabled: true,
          events: {
            ptFlip: false,
            bookChange: false,
            cashBrake: false,
            morningPostcard: true,
          },
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPostcardMsg(payload.error || 'Could not save postcard preference.');
        return;
      }
      setPostcardMsg('You’re on the morning postcard list. No trading required.');
    } catch {
      setPostcardMsg('Could not save postcard preference.');
    } finally {
      setPostcardBusy(false);
    }
  }

  return (
    <div>
      <ScannerExtrasNav active="/scanner/garden" />

      <header className="mb-8 overflow-hidden rounded-3xl border border-emerald-800/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/30 p-8 shadow-2xl shadow-emerald-950/20">
        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-400">
          Garden · you don’t have to trade
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-zinc-50">Today</h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-zinc-300">{mood}</p>
        <p className="mt-4 font-mono text-xs text-zinc-500">
          Updated <span className="text-zinc-300">{asOf}</span>
        </p>
      </header>

      {loading ? <p className="text-zinc-400">Loading the canopy…</p> : null}
      {error ? <p className="mb-4 text-red-300">{error}</p> : null}

      <section className="mb-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
          What’s growing
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {leaves.length ? (
            leaves.map((leaf) => (
              <Link
                key={leaf.ticker}
                href={`/scanner/charts?ticker=${encodeURIComponent(leaf.ticker)}`}
                className="rounded-2xl border border-emerald-900/40 bg-zinc-900/80 p-5 transition hover:border-emerald-600/60"
              >
                <p className="font-mono text-xl font-semibold text-emerald-300">{leaf.ticker}</p>
                <p className="mt-1 text-sm text-zinc-200">{leaf.theme}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{leaf.note}</p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-500 sm:col-span-3">
              No leading leaves yet — walk the Forest while the board refreshes.
            </p>
          )}
        </div>
      </section>

      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link
          href="/scanner/forest"
          className="rounded-2xl border border-lime-800/50 bg-lime-950/20 p-6 transition hover:border-lime-500/60"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-lime-400">
            Wander
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Walk the Forest</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Leaves instead of tables — tap a name for plain English, not accel scores.
          </p>
        </Link>
        <Link
          href="/scanner/desk-brief"
          className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-6 transition hover:border-amber-500/60"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-400">
            Postcard
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Morning note</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            A short read. If you only have two minutes, this is enough.
          </p>
        </Link>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-semibold text-zinc-100">One optional action</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Follow what’s leading on the Leaders board — or do nothing and just watch the canopy. We
          never ask for brokerage API keys or manage your account.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/scanner/leaders"
            className="rounded-full border border-cyan-600 bg-cyan-950/50 px-4 py-2 text-sm font-semibold text-cyan-200 hover:border-cyan-400"
          >
            See Leaders
          </Link>
          <button
            type="button"
            disabled={postcardBusy}
            onClick={() => void optInPostcard()}
            className="rounded-full border border-amber-700 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-200 hover:border-amber-500 disabled:opacity-60"
          >
            {postcardBusy ? 'Saving…' : 'Email me the morning postcard'}
          </button>
        </div>
        {postcardMsg ? <p className="mt-3 text-sm text-zinc-400">{postcardMsg}</p> : null}
      </section>
    </div>
  );
}
