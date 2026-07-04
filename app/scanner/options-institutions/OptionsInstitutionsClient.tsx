'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import FlowPanel from '@/components/scanner/FlowPanel';
import FlowSummaryStrip from '@/components/scanner/FlowSummaryStrip';
import type { FlowPublicSummary, FlowTickerPayload } from '@/lib/scanner-flow-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: 'viewer' | 'developer' };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

export default function OptionsInstitutionsClient() {
  const searchParams = useSearchParams();
  const urlTicker = (searchParams.get('ticker') || '').trim().toUpperCase();

  const [user, setUser] = useState<ScannerUser | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [search, setSearch] = useState(urlTicker);
  const [activeTicker, setActiveTicker] = useState(urlTicker);
  const [developerData, setDeveloperData] = useState<FlowTickerPayload | null>(null);
  const [viewerSummary, setViewerSummary] = useState<FlowPublicSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bootLoading, setBootLoading] = useState(true);

  const isDeveloper = user?.role === 'developer';

  const filteredTickers = useMemo(() => {
    const query = search.trim().toUpperCase();
    if (!query) return tickers;
    return tickers.filter((ticker) => ticker.includes(query));
  }, [search, tickers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessionRes = await fetch('/api/scanner/session', fetchInit);
        const sessionPayload = sessionRes.ok ? await sessionRes.json() : null;
        if (!cancelled && sessionPayload?.user) setUser(sessionPayload.user);

        const manifestRes = await fetch('/api/scanner/charts/manifest', fetchInit);
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          const list = (manifest?.tickers || []).map((t: string) => String(t).toUpperCase());
          if (!cancelled) setTickers(list);
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTicker = useCallback(async (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    if (!symbol) return;
    setLoading(true);
    setError('');
    setDeveloperData(null);
    setViewerSummary(null);
    try {
      const response = await fetch(`/api/scanner/flow?ticker=${encodeURIComponent(symbol)}`, fetchInit);
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.message || payload?.error || `No flow data for ${symbol}.`);
        return;
      }
      if (payload.ticker && typeof payload.ticker === 'object') {
        setDeveloperData(payload.ticker as FlowTickerPayload);
        setViewerSummary((payload.ticker as FlowTickerPayload).publicSummary);
      } else if (payload.publicSummary) {
        setViewerSummary(payload.publicSummary as FlowPublicSummary);
      }
    } catch {
      setError(`Could not load flow data for ${symbol}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlTicker) {
      setSearch(urlTicker);
      setActiveTicker(urlTicker);
      void loadTicker(urlTicker);
    }
  }, [loadTicker, urlTicker]);

  const selectTicker = (ticker: string) => {
    const symbol = ticker.trim().toUpperCase();
    setSearch(symbol);
    setActiveTicker(symbol);
    void loadTicker(symbol);
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <ScannerExtrasNav active="/scanner/options-institutions" theme="light" />

        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Private scanner</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Options / institutions</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-700">
            See whether institutions are accumulating or distributing, today&apos;s options bias, and recent volume
            confirmation. Developer view shows licensed FMP numbers; other users see icon summaries only.
          </p>
        </div>

        <div className="mb-4 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Search ticker</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (search.trim()) selectTicker(search.trim());
                }
              }}
              placeholder="Type symbol (e.g. NVDA)"
              className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-lg text-zinc-900 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
              spellCheck={false}
              autoCapitalize="characters"
            />
          </label>
          <p className="mt-2 text-xs text-zinc-700">
            {tickers.length ? `${tickers.length} scanner chart tickers` : bootLoading ? 'Loading tickers…' : 'Ticker list unavailable'}
            {search.trim() ? ` · ${filteredTickers.length} match` : ''}
          </p>
          {search.trim() && filteredTickers.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {filteredTickers.slice(0, 12).map((ticker) => (
                <button
                  key={ticker}
                  type="button"
                  onClick={() => selectTicker(ticker)}
                  className={`rounded-full border px-3 py-1.5 font-mono text-sm font-semibold transition ${
                    activeTicker === ticker
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-zinc-400 bg-white text-zinc-900 hover:border-zinc-600 hover:bg-zinc-50'
                  }`}
                >
                  {ticker}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {error ? <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

        {loading ? (
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">Loading flow data…</div>
        ) : isDeveloper && developerData ? (
          <FlowPanel data={developerData} />
        ) : viewerSummary ? (
          <FlowSummaryStrip ticker={activeTicker} summary={viewerSummary} showLink={false} isDeveloper={false} compact={false} />
        ) : activeTicker ? (
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">
            No flow data loaded for {activeTicker}.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">
            Pick a ticker to view options and institutional flow.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/scanner/charts" className="font-semibold text-emerald-700 hover:text-emerald-800">
            ← Back to charts
          </Link>
          {user ? (
            <span className="text-zinc-600">
              Signed in as {user.email} ({user.role})
            </span>
          ) : null}
        </div>
      </div>
    </main>
  );
}
