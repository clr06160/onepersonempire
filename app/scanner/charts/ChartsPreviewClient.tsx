'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { ChartManifest, ScannerChartPayload } from '@/lib/charts/load-chart-data';
import type { ScannerNewsItem } from '@/lib/scanner-news-data';
import type { FlowPublicSummary } from '@/lib/scanner-flow-data';
import FlowSummaryStrip from '@/components/scanner/FlowSummaryStrip';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import ChartPanelErrorBoundary from './ChartPanelErrorBoundary';
import { canAccessDreamTreeChartData } from '@/lib/scanner-chart-access';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

const StockChartPanel = dynamic(() => import('./StockChartPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[1040px] items-center justify-center rounded-xl border border-zinc-300 bg-white">
      <p className="text-base text-zinc-700">Loading chart module…</p>
    </div>
  ),
});

const TradingViewWidgetPanel = dynamic(() => import('./TradingViewWidgetPanel'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[700px] items-center justify-center rounded-xl border border-zinc-300 bg-white">
      <p className="text-base text-zinc-700">Loading chart…</p>
    </div>
  ),
});

type ScannerUser = {
  email: string;
  role: 'viewer' | 'developer';
};

const scannerFetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function relativeTime(published?: string) {
  if (!published) return '';
  const parsed = new Date(published.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return published;
  const mins = Math.round((Date.now() - parsed.getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

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
  const [newsByTicker, setNewsByTicker] = useState<Record<string, ScannerNewsItem[]>>({});
  const [newsLoaded, setNewsLoaded] = useState(false);
  const [flowSummary, setFlowSummary] = useState<FlowPublicSummary | null>(null);
  const [flowLoading, setFlowLoading] = useState(false);

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

  // Dream Tree charts for developer always; for viewers when redistribution license is active.
  const useDreamTreeCharts = canAccessDreamTreeChartData(user);
  const isDeveloper = user?.role === 'developer';

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
        setChartError(toScannerUserMessage(payload.error, `Could not load chart for ${ticker}.`));
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

  // Owner-only headlines, sourced from a licensed provider the API gates to the
  // developer account. Fetched once and indexed by ticker for the preview panel.
  const loadNews = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/news', scannerFetchInit);
      const payload = await response.json();
      if (response.ok && !payload.restricted) {
        setNewsByTicker(payload.data?.byTicker || {});
      }
    } catch {
      // Preview is best-effort; ignore failures.
    } finally {
      setNewsLoaded(true);
    }
  }, []);

  const loadFlowSummary = useCallback(async (ticker: string) => {
    if (!ticker) {
      setFlowSummary(null);
      return;
    }
    setFlowLoading(true);
    try {
      const response = await fetch(`/api/scanner/flow?ticker=${encodeURIComponent(ticker)}`, scannerFetchInit);
      const payload = await response.json();
      if (!response.ok) {
        setFlowSummary(null);
        return;
      }
      if (payload.publicSummary) {
        setFlowSummary(payload.publicSummary as FlowPublicSummary);
      } else if (payload.ticker?.publicSummary) {
        setFlowSummary(payload.ticker.publicSummary as FlowPublicSummary);
      } else {
        setFlowSummary(null);
      }
    } catch {
      setFlowSummary(null);
    } finally {
      setFlowLoading(false);
    }
  }, []);

  useEffect(() => {
    loadManifest()
      .catch((error: Error) => setManifestError(toScannerUserMessage(error, 'Could not load scanner tickers.')))
      .finally(() => setBootLoading(false));
  }, [loadManifest]);

  useEffect(() => {
    if (!isDeveloper) return;
    loadNews();
  }, [isDeveloper, loadNews]);

  useEffect(() => {
    if (!pendingTicker || !useDreamTreeCharts) return;
    const timer = window.setTimeout(() => {
      loadChart(pendingTicker);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadChart, pendingTicker, useDreamTreeCharts]);

  // TradingView fallback: no server chart fetch; sync selection locally.
  useEffect(() => {
    if (useDreamTreeCharts || !pendingTicker) return;
    setActiveTicker(pendingTicker);
  }, [useDreamTreeCharts, pendingTicker]);

  useEffect(() => {
    const ticker = activeTicker || pendingTicker;
    if (!ticker || !isDeveloper) return;
    void loadFlowSummary(ticker);
  }, [activeTicker, pendingTicker, isDeveloper, loadFlowSummary]);

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

  const newsTicker = activeTicker || pendingTicker;
  const tickerNews = newsByTicker[newsTicker] || [];

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1600px]">
        <ScannerExtrasNav active="/scanner/charts" theme="light" />
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
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">
            Loading scanner tickers…
          </div>
        ) : manifestError ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">{manifestError}</div>
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-stretch">
              <div className="rounded-xl border border-zinc-300 bg-white p-4 shadow-sm lg:flex-1">
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
                    className="w-full max-w-md rounded-lg border border-zinc-300 bg-white px-4 py-2.5 font-mono text-lg text-zinc-900 placeholder:text-zinc-600 focus:border-emerald-600 focus:outline-none"
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                </label>
                <p className="mt-2 text-xs text-zinc-700">
                  {tickers.length} chart tickers
                  {tickerSource ? ` · ${tickerSource.replace('+', ' + ')}` : ''}
                  {search.trim() ? ` · ${filteredTickers.length} match "${search.trim().toUpperCase()}"` : ''}
                </p>

                {search.trim() && filteredTickers.length > 1 && !exactTickerMatch ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="w-full text-xs font-medium text-zinc-700">Multiple matches — pick one or press Enter for top hit:</span>
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
                    {filteredTickers.length > 12 ? (
                      <span className="self-center text-xs text-zinc-600">
                        +{filteredTickers.length - 12} more — refine search
                      </span>
                    ) : null}
                  </div>
                ) : search.trim() && !filteredTickers.length ? (
                  <p className="mt-2 text-sm text-zinc-700">No matching chart tickers.</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 lg:w-96 lg:flex-shrink-0">
                {isDeveloper ? (
                  <FlowSummaryStrip
                    ticker={newsTicker}
                    summary={flowSummary}
                    loading={flowLoading}
                    isDeveloper={isDeveloper}
                  />
                ) : null}

              {isDeveloper ? (
                <aside className="rounded-xl border border-zinc-300 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-800">
                      {newsTicker ? `${newsTicker} news` : 'News'}
                    </span>
                    <Link
                      href="/scanner/news"
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                    >
                      All news →
                    </Link>
                  </div>

                  {!newsTicker ? (
                    <p className="text-sm text-zinc-600">Load a ticker to see its latest headlines.</p>
                  ) : !newsLoaded ? (
                    <p className="text-sm text-zinc-500">Loading news…</p>
                  ) : tickerNews.length === 0 ? (
                    <p className="text-sm text-zinc-600">
                      No scanner headlines for {newsTicker}.{' '}
                      <a
                        href={`https://news.google.com/search?q=${encodeURIComponent(`${newsTicker} stock`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-emerald-700 hover:underline"
                      >
                        Search the web →
                      </a>
                    </p>
                  ) : (
                    <ul className="space-y-2.5">
                      {tickerNews.slice(0, 5).map((item, index) => (
                        <li key={`${item.url || item.title}-${index}`}>
                          <a
                            href={item.url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block"
                          >
                            <span className="block text-sm font-semibold leading-snug text-zinc-900 line-clamp-2 group-hover:text-emerald-700">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] uppercase tracking-wide text-zinc-500">
                              {item.publisher || item.site || ''}
                              {item.publishedDate ? ` · ${relativeTime(item.publishedDate)}` : ''}
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>
              ) : null}
              </div>
            </div>

            {useDreamTreeCharts && chartError && pendingTicker !== activeTicker ? (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {chartError} Showing {activeTicker || 'previous'} chart.
              </div>
            ) : null}

            {useDreamTreeCharts ? (
              <ChartPanelErrorBoundary ticker={activeTicker || pendingTicker}>
                <StockChartPanel
                  ticker={activeTicker || pendingTicker}
                  data={data}
                  loading={loading && !data}
                  error={chartError && !data ? chartError : ''}
                  onSelectTicker={selectTicker}
                />
              </ChartPanelErrorBoundary>
            ) : (
              <TradingViewWidgetPanel ticker={activeTicker || pendingTicker} />
            )}

            {user ? (
              <p className="mt-3 text-xs text-zinc-700">
                Signed in as {user.email} ({user.role})
              </p>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
