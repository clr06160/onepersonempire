'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ChartManifest, ScannerChartPayload } from '@/lib/charts/load-chart-data';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import ChartPanelErrorBoundary from './ChartPanelErrorBoundary';

const StockChartPanel = dynamic(() => import('./StockChartPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[1040px] items-center justify-center rounded-xl border border-zinc-300 bg-white">
      <p className="text-base text-zinc-500">Loading chart module…</p>
    </div>
  ),
});

type ScannerUser = {
  email: string;
  role: 'viewer' | 'developer';
};

const scannerFetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

export default function ChartsPreviewClient() {
  const searchParams = useSearchParams();
  const urlTicker = (searchParams.get('ticker') || '').trim().toUpperCase();
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [tickerSource, setTickerSource] = useState('');
  const [manifestError, setManifestError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [pendingTicker, setPendingTicker] = useState('');
  const [data, setData] = useState<ScannerChartPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [chartError, setChartError] = useState('');

  const filteredTickers = useMemo(() => {
    const query = search.trim().toUpperCase();
    if (!query) return tickers;
    return tickers.filter((ticker) => ticker.includes(query));
  }, [search, tickers]);

  const exactTickerMatch = useMemo(() => {
    const query = search.trim().toUpperCase();
    if (!query) return null;
    return tickers.includes(query) ? query : null;
  }, [search, tickers]);

  const loadManifest = useCallback(async () => {
    const response = await fetch('/api/scanner/charts/manifest', scannerFetchInit);
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Could not load scanner tickers.');
    }
    setUser(payload.user || null);
    const manifest = payload.manifest as ChartManifest;
    const list = manifest?.tickers || [];
    setTickers(list);
    setTickerSource(manifest?.tickerSource || '');
    const initial = urlTicker || list[0] || '';
    setActiveTicker((current) => current || initial);
    setPendingTicker((current) => current || initial);
    if (urlTicker) setSearch(urlTicker);
  }, [urlTicker]);

  const loadChart = useCallback(async (ticker: string) => {
    if (!ticker) return;
    setLoading(true);
    setChartError('');
    try {
      const response = await fetch(`/api/scanner/charts/${encodeURIComponent(ticker)}`, scannerFetchInit);
      const payload = await response.json();
      if (!response.ok) {
        setChartError(payload.error || `Could not load chart for ${ticker}.`);
        return;
      }
      setUser(payload.user || null);
      setData(payload.data || null);
      setActiveTicker(ticker);
      setChartError('');
    } catch {
      setChartError(`Could not load chart for ${ticker}.`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManifest()
      .catch((error: Error) => setManifestError(error.message || 'Could not load scanner tickers.'))
      .finally(() => setBootLoading(false));
  }, [loadManifest]);

  useEffect(() => {
    if (!pendingTicker) return;
    const timer = window.setTimeout(() => {
      loadChart(pendingTicker);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadChart, pendingTicker]);

  // Exact symbol typed → load chart without clicking a pill.
  useEffect(() => {
    if (!exactTickerMatch) return;
    const timer = window.setTimeout(() => {
      setPendingTicker((current) => (current === exactTickerMatch ? current : exactTickerMatch));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [exactTickerMatch]);

  const selectTicker = (ticker: string) => {
    setPendingTicker(ticker);
    setSearch(ticker);
  };

  const commitSearch = () => {
    const query = search.trim().toUpperCase();
    if (!query) return;
    if (exactTickerMatch) {
      selectTicker(exactTickerMatch);
      return;
    }
    if (filteredTickers.length === 1) {
      selectTicker(filteredTickers[0]);
      return;
    }
    if (filteredTickers.length) {
      selectTicker(filteredTickers[0]);
    }
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitSearch();
  };

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <ScannerExtrasNav active="/scanner/charts" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
              Chart preview (beta)
            </p>
            <h1 className="text-2xl font-bold sm:text-3xl">Scanner Charts</h1>
          </div>
          <Link
            href="/scanner"
            className="rounded-full border border-zinc-400 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-600"
          >
            Back to scanner
          </Link>
        </div>

        {bootLoading ? (
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-500">
            Loading scanner tickers…
          </div>
        ) : manifestError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">{manifestError}</div>
        ) : (
          <>
            <div className="mb-4 rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Search ticker</span>
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value.toUpperCase())}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => {
                    if (exactTickerMatch) selectTicker(exactTickerMatch);
                  }}
                  placeholder="Type symbol (e.g. NVDA) — loads when exact match"
                  className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-lg text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:outline-none"
                  spellCheck={false}
                  autoCapitalize="characters"
                />
              </label>
              <p className="mt-2 text-xs text-zinc-500">
                {tickers.length} chart tickers
                {tickerSource ? ` · ${tickerSource.replace('+', ' + ')}` : ''}
                {search.trim() ? ` · ${filteredTickers.length} match "${search.trim().toUpperCase()}"` : ''}
              </p>

              {search.trim() && filteredTickers.length > 1 && !exactTickerMatch ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="w-full text-xs text-zinc-500">Multiple matches — pick one or press Enter for top hit:</span>
                  {filteredTickers.slice(0, 12).map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        onClick={() => selectTicker(ticker)}
                        className={`rounded-full border px-3 py-1.5 font-mono text-sm font-semibold transition ${
                          activeTicker === ticker
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                            : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        {ticker}
                      </button>
                    ))}
                  {filteredTickers.length > 12 ? (
                    <span className="self-center text-xs text-zinc-600">
                      +{filteredTickers.length - 12} more — refine search
                    </span>
                  ) : null}
                </div>
              ) : search.trim() && !filteredTickers.length ? (
                <p className="mt-2 text-sm text-zinc-500">No matching chart tickers.</p>
              ) : null}
            </div>

            {chartError && pendingTicker !== activeTicker ? (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {chartError} Showing {activeTicker || 'previous'} chart.
              </div>
            ) : null}

            <ChartPanelErrorBoundary ticker={activeTicker || pendingTicker}>
              <StockChartPanel
                ticker={activeTicker || pendingTicker}
                data={data}
                loading={loading && !data}
                error={chartError && !data ? chartError : ''}
                onSelectTicker={selectTicker}
              />
            </ChartPanelErrorBoundary>

            {user ? (
              <p className="mt-3 text-xs text-zinc-500">
                Signed in as {user.email} ({user.role})
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
