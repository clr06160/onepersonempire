'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type { ScannerNewsItem, ScannerNewsPayload } from '@/lib/scanner-news-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const TAG_CLASS: Record<string, string> = {
  Earnings: 'border-amber-600/70 bg-amber-950/60 text-amber-200',
  Analyst: 'border-sky-700/60 bg-sky-950/50 text-sky-200',
  Guidance: 'border-emerald-700/70 bg-emerald-950/50 text-emerald-200',
  'M&A': 'border-violet-700/60 bg-violet-950/50 text-violet-200',
  Legal: 'border-red-800/70 bg-red-950/50 text-red-200',
  Product: 'border-teal-700/60 bg-teal-950/50 text-teal-200',
  Management: 'border-zinc-600 bg-zinc-800 text-zinc-200',
};

function tagClass(tag: string) {
  return TAG_CLASS[tag] || 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function relativeTime(published?: string) {
  if (!published) return '';
  const parsed = new Date(published.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return published;
  const diffMs = Date.now() - parsed.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function NewsCard({ item }: { item: ScannerNewsItem }) {
  return (
    <article className="flex gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="hidden h-16 w-24 flex-shrink-0 rounded-md object-cover sm:block"
          onError={(event) => {
            (event.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {item.ticker ? (
            <TickerLink ticker={item.ticker} className="text-sm font-semibold text-emerald-200" />
          ) : null}
          {(item.tags || []).map((tag) => (
            <span key={tag} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tagClass(tag)}`}>
              {tag}
            </span>
          ))}
          <span className="ml-auto text-[11px] text-zinc-500">{relativeTime(item.publishedDate)}</span>
        </div>
        <a
          href={item.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[15px] font-semibold leading-snug text-zinc-100 hover:text-emerald-200"
        >
          {item.title}
        </a>
        {item.snippet ? <p className="mt-1 line-clamp-2 text-sm text-zinc-400">{item.snippet}</p> : null}
        <div className="mt-1.5 text-[11px] uppercase tracking-wide text-zinc-600">{item.publisher || item.site || ''}</div>
      </div>
    </article>
  );
}

export default function NewsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ScannerNewsPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<'picks' | 'market'>('picks');
  const [tickerFilter, setTickerFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [restricted, setRestricted] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/news', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (response.status === 403 || payload.restricted) {
      setRestricted(true);
      setError('');
      return;
    }
    if (!response.ok) {
      setError(payload.error || 'Could not load scanner news.');
      return;
    }
    setError('');
    setRestricted(false);
    setUser(payload.user || null);
    setData(payload.data || null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const tickers = useMemo(() => Object.keys(data?.byTicker || {}).sort(), [data]);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    (data?.feed || []).forEach((item) => (item.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [data]);

  const items = useMemo(() => {
    const base = scope === 'market' ? data?.market || [] : data?.feed || [];
    return base.filter((item) => {
      if (scope === 'picks' && tickerFilter !== 'all' && item.ticker !== tickerFilter) return false;
      if (tagFilter !== 'all' && !(item.tags || []).includes(tagFilter)) return false;
      return true;
    });
  }, [data, scope, tickerFilter, tagFilter]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/news" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading news...</section>
      ) : restricted ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Owner-only feed</h2>
          <p className="mt-2 max-w-2xl text-zinc-300">
            The news feed is sourced from a licensed provider and can&apos;t be redistributed, so it&apos;s
            limited to the owner account. Other scanner tools remain available from the nav above.
          </p>
        </section>
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
              <h2 className="text-2xl font-semibold">News &amp; catalysts</h2>
              <p className="text-sm text-zinc-400">
                {data?.itemCount ?? 0} headlines across {data?.tickerCount ?? 0} picks · last{' '}
                {data?.maxAgeDays ?? 21} days
              </p>
              <p className="text-xs text-zinc-500">Logged in as {user.email}</p>
            </div>
            {data?.generatedAt ? (
              <span className="text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
            ) : null}
          </div>

          {error ? <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}

          {data?.message && !items.length ? (
            <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border border-zinc-700 p-0.5">
              {(['picks', 'market'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                    scope === value ? 'bg-emerald-700 text-white' : 'text-zinc-300 hover:text-white'
                  }`}
                >
                  {value === 'picks' ? 'Pick news' : 'Market'}
                </button>
              ))}
            </div>

            {scope === 'picks' ? (
              <select
                value={tickerFilter}
                onChange={(event) => setTickerFilter(event.target.value)}
                className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-200"
              >
                <option value="all">All picks ({tickers.length})</option>
                {tickers.map((ticker) => (
                  <option key={ticker} value={ticker}>
                    {ticker} ({(data?.byTicker?.[ticker] || []).length})
                  </option>
                ))}
              </select>
            ) : null}

            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-200"
            >
              <option value="all">All catalysts</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            <span className="ml-auto text-xs text-zinc-500">{items.length} shown</span>
          </div>

          {!items.length ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-400">
              No headlines match the current filters.
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((item, index) => (
                <NewsCard key={`${item.url || item.title}-${index}`} item={item} />
              ))}
            </div>
          )}

          {data?.note ? <p className="mt-6 text-xs text-zinc-600">{data.note}</p> : null}
        </section>
      )}
    </>
  );
}
