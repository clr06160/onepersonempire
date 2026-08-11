'use client';

import { useCallback, useEffect, useState } from 'react';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type { DeskBriefPayload } from '@/lib/scanner-desk-brief';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function formatWhen(iso?: string) {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DeskBriefClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<DeskBriefPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/scanner/desk-brief', fetchInit);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not load morning note.');
      }
      setUser(json.user || null);
      setData(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load morning note.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    setError('');
    try {
      const res = await fetch('/api/scanner/desk-brief', { ...fetchInit, method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Could not regenerate morning note.');
      }
      setUser(json.user || null);
      setData(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate morning note.');
    } finally {
      setRegenerating(false);
    }
  }, []);

  const isDeveloper = user?.role === 'developer';

  return (
    <div className="space-y-6">
      <ScannerExtrasNav active="/scanner/desk-brief" />

      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        {data?.asOf ? <span>As of {data.asOf}</span> : null}
        {data?.generatedAt ? <span>· Written {formatWhen(data.generatedAt)}</span> : null}
        {isDeveloper ? (
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={regenerating}
            className="ml-auto rounded-lg border border-amber-700/70 bg-amber-950/50 px-3 py-1.5 text-amber-100 hover:bg-amber-900/60 disabled:opacity-50"
          >
            {regenerating ? 'Writing note + image…' : 'Regenerate note'}
          </button>
        ) : null}
      </div>

      {loading ? <p className="text-zinc-400">Loading morning note…</p> : null}
      {error ? (
        <p className="rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!loading && data && !data.connected ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-zinc-300">{data.message || 'Morning note not ready yet.'}</p>
          {isDeveloper ? (
            <p className="mt-3 text-sm text-zinc-500">
              Hit Regenerate to write today&apos;s note and Nano Banana mood image from Flight Deck,
              macro, FedWatch, and catalysts.
            </p>
          ) : null}
        </div>
      ) : null}

      {!loading && data?.connected ? (
        <article className="space-y-6">
          {data.hasImage && data.imageSrc ? (
            <figure className="-mx-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.imageSrc}
                alt={data.imageAlt || data.headline || 'Morning market mood'}
                className="aspect-[16/9] w-full object-cover"
              />
              <figcaption className="border-t border-zinc-800 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                Yesterday&apos;s tape · Nano Banana
              </figcaption>
            </figure>
          ) : null}

          <h2 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
            {data.headline}
          </h2>

          {data.bullets?.length ? (
            <ul className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              {data.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-2 text-[15px] leading-6 text-zinc-200">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {data.sections.map((section) => (
            <section key={section.id} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400/90">
                {section.title}
              </h3>
              <div className="space-y-3 text-[15px] leading-7 text-zinc-300 whitespace-pre-wrap">
                {section.body}
              </div>
            </section>
          ))}

          {data.watch?.length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
                Watch list
              </h3>
              <ul className="mt-3 space-y-2">
                {data.watch.map((item) => (
                  <li key={item} className="text-sm leading-6 text-zinc-300">
                    · {item}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="text-xs leading-5 text-zinc-600">
            {data.disclaimer}
            {data.sourceNote ? ` ${data.sourceNote}` : null}
          </p>
        </article>
      ) : null}
    </div>
  );
}
