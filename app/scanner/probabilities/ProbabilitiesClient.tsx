'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ProbabilitiesPayload, ProbabilityCard, ProbabilityTone } from '@/lib/scanner-probabilities-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function toneClass(tone: ProbabilityTone) {
  if (tone === 'ok') return 'text-emerald-300';
  if (tone === 'warn') return 'text-amber-300';
  if (tone === 'hot') return 'text-red-300';
  if (tone === 'cold') return 'text-sky-300';
  return 'text-zinc-200';
}

function kindLabel(kind: ProbabilityCard['kind']) {
  if (kind === 'model') return 'Model odds';
  if (kind === 'hitRate') return 'Hit rate';
  if (kind === 'marketOdds') return 'Market odds';
  if (kind === 'heuristic') return 'Heuristic';
  return 'Reality check';
}

function ProbabilityTile({ card }: { card: ProbabilityCard }) {
  return (
    <article
      className={`rounded-xl border p-5 ${
        card.kind === 'tongueInCheek'
          ? 'border-amber-800/60 bg-amber-950/20'
          : 'border-zinc-800 bg-zinc-950/70'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{card.group}</p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-100">{card.title}</h3>
        </div>
        <span className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
          {kindLabel(card.kind)}
        </span>
      </div>

      <p className={`mt-4 font-mono text-4xl font-semibold tracking-tight ${toneClass(card.tone)}`}>{card.display}</p>
      <p className="mt-2 text-sm text-zinc-400">{card.subtitle}</p>
      <p className="mt-3 text-sm text-zinc-300">{card.detail}</p>

      {card.secondary?.length ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {card.secondary.map((row) => (
            <span key={row.label}>
              {row.label}: <span className="font-mono text-zinc-300">{row.display}</span>
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-zinc-500">{card.caveat}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        {card.sampleSize != null ? <span>n={card.sampleSize}</span> : null}
        {card.asOf ? <span>as of {card.asOf}</span> : null}
        {card.href ? (
          <Link href={card.href} className="text-emerald-400 hover:text-emerald-300">
            Open source →
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export default function ProbabilitiesClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ProbabilitiesPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/probabilities', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load probabilities.');
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

  const groups = useMemo(() => {
    const map = new Map<string, ProbabilityCard[]>();
    for (const card of data?.cards || []) {
      const list = map.get(card.group) || [];
      list.push(card);
      map.set(card.group, list);
    }
    return [...map.entries()];
  }, [data?.cards]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/probabilities" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading probabilities...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold">Scanner odds board</h2>
            <p className="mt-2 max-w-4xl text-sm text-zinc-400">
              Logged in as {user.email}. Pulled from {data?.sourceCount ?? 0} dashboards
              {data?.missingSources?.length ? ` · skipped ${data.missingSources.join(', ')}` : ''}.
            </p>
            {data?.note ? <p className="mt-3 max-w-4xl text-sm text-zinc-500">{data.note}</p> : null}
            {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}
            {data?.message ? (
              <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
            ) : null}
          </section>

          {groups.map(([group, cards]) => (
            <section key={group} className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">{group}</h3>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {cards.map((card) => (
                  <ProbabilityTile key={card.id} card={card} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
