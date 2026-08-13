'use client';

import Script from 'next/script';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EbitdaForwardTest, EbitdaName, EbitdaPayload } from '@/lib/ebitda-shared';
import { filterEbitdaNames } from '@/lib/ebitda-shared';
import ScannerExtrasNav from '@/app/scanner/_extras/ScannerExtrasNav';

type ScannerUser = {
  email: string;
  name?: string;
  picture?: string;
  role: 'viewer' | 'developer';
};

type EbitdaResponse = {
  user?: ScannerUser;
  data?: EbitdaPayload;
  error?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    nonce?: string;
    use_fedcm_for_button?: boolean;
    auto_select?: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
};

function getGoogleAccountsId(): GoogleAccountsId | null {
  const google = (window as Window & { google?: { accounts?: { id?: GoogleAccountsId } } }).google;
  return google?.accounts?.id || null;
}

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function formatPp(value: number) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)} pp`;
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function pctClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-400';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-red-300';
  return 'text-zinc-300';
}

function money(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ForwardTestPanel({ forwardTest }: { forwardTest?: EbitdaForwardTest | null }) {
  if (!forwardTest?.universes?.length) return null;
  const topN = forwardTest.topN || 10;

  return (
    <section className="rounded-2xl border border-emerald-900/40 bg-zinc-900 p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">Forward test</p>
      <h2 className="mt-1 text-xl font-semibold text-zinc-100">Top {topN} margin expanders by universe</h2>
      <p className="mt-2 max-w-4xl text-sm text-zinc-400">
        {forwardTest.method ||
          `Equal-weight top ${topN} like the Top Ten tester — one book per universe (NASDAQ-100, S&P 500 / SPY, Russell).`}
      </p>
      {forwardTest.note ? <p className="mt-2 text-xs text-zinc-500">{forwardTest.note}</p> : null}
      <p className="mt-3 text-sm text-zinc-500">
        As of {forwardTest.asOf || 'n/a'}
        {forwardTest.updatedAt ? ` · updated ${forwardTest.updatedAt}` : ''}
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-700 text-left text-zinc-400">
              <th className="py-2 pr-3">Universe</th>
              <th className="py-2 pr-3 text-right">Equity</th>
              <th className="py-2 pr-3 text-right">Total</th>
              <th className="py-2 pr-3 text-right">Max DD</th>
              <th className="py-2 pr-3 text-right">Open</th>
              <th className="py-2 pr-3 text-right">Live avg</th>
              <th className="py-2 pr-3 text-right">Hit rate</th>
              <th className="py-2 pr-3">Top {topN} holdings</th>
            </tr>
          </thead>
          <tbody>
            {forwardTest.universes.map((row) => (
              <tr key={row.key} className="border-b border-zinc-800/80 align-top">
                <td className="py-3 pr-3 font-semibold text-zinc-100">{row.label}</td>
                <td className="py-3 pr-3 text-right font-mono text-zinc-200">{money(row.equity)}</td>
                <td className={`py-3 pr-3 text-right font-mono ${pctClass(row.totalReturnPct ?? row.summary?.totalReturnPct)}`}>
                  {formatPct(row.totalReturnPct ?? row.summary?.totalReturnPct)}
                </td>
                <td className={`py-3 pr-3 text-right font-mono ${pctClass(row.maxDrawdownPct)}`}>
                  {formatPct(row.maxDrawdownPct)}
                </td>
                <td className="py-3 pr-3 text-right font-mono text-zinc-300">{row.openCount ?? row.currentTickers?.length ?? 0}</td>
                <td className={`py-3 pr-3 text-right font-mono ${pctClass(row.openAvgReturnPct)}`}>
                  {formatPct(row.openAvgReturnPct)}
                </td>
                <td className="py-3 pr-3 text-right font-mono text-zinc-400">{formatPct(row.summary?.hitRatePct)}</td>
                <td className="py-3 pr-3 text-xs leading-relaxed text-zinc-400">
                  {row.currentTickers?.length ? row.currentTickers.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {forwardTest.universes.map((row) => (
          <div key={`${row.key}-detail`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="font-semibold text-emerald-200">{row.label} · live book</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {row.summary?.closedCount ?? 0} closed · {row.summary?.periodCount ?? 0} periods
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {(row.openPositions || []).slice(0, 5).map((pos) => (
                <li key={`${row.key}-${pos.ticker}`} className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-100">{pos.ticker}</span>
                  <span className={`font-mono ${pctClass(pos.currentReturnPct ?? pos.returnPct)}`}>
                    {formatPct(pos.currentReturnPct ?? pos.returnPct)}
                  </span>
                </li>
              ))}
              {!row.openPositions?.length ? <li className="text-zinc-500">No open marks yet — next rebuild starts the book.</li> : null}
            </ul>
            {row.recentClosed?.length ? (
              <div className="mt-4 border-t border-zinc-800 pt-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Recent closed</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-400">
                  {row.recentClosed.slice(0, 3).map((pos) => (
                    <li key={`${row.key}-closed-${pos.ticker}-${pos.exitDate || ''}`} className="flex justify-between gap-2">
                      <span>{pos.ticker}</span>
                      <span className={`font-mono ${pctClass(pos.returnPct)}`}>{formatPct(pos.returnPct)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function MarginSparkline({ quarters }: { quarters: EbitdaName['quarters'] }) {
  if (!quarters.length) {
    return <div className="h-10 text-xs text-zinc-600">No quarter series</div>;
  }

  const values = quarters.map((quarter) => quarter.ebitdaMargin);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const width = 120;
  const height = 36;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-9 w-28 overflow-visible" aria-hidden>
      <polyline fill="none" stroke="#34d399" strokeWidth="2" points={points} />
      {values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        const y = height - ((value - min) / span) * (height - 4) - 2;
        return <circle key={`${value}-${index}`} cx={x} cy={y} r="2.2" fill="#6ee7b7" />;
      })}
    </svg>
  );
}

type EbitdaPageClientProps = {
  googleClientId: string;
};

export default function EbitdaPageClient({ googleClientId: initialGoogleClientId }: EbitdaPageClientProps) {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<EbitdaPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState(initialGoogleClientId);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [minDeltaPp, setMinDeltaPp] = useState(5);
  const [requireNonCollapsingRevenue, setRequireNonCollapsingRevenue] = useState(true);
  const [requireAbove200dma, setRequireAbove200dma] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('');
  const renderAttemptsRef = useRef(0);
  const tryRenderGoogleButtonRef = useRef<() => void>(() => {});

  const loadData = useCallback(async () => {
    const response = await fetch('/api/ebitda', fetchInit);
    const payload = (await response.json()) as EbitdaResponse;
    if (response.status === 401) {
      setUser(null);
      setData(null);
      return;
    }
    if (!response.ok) {
      setError(payload.error || 'Could not load EBITDA margin data.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData(payload.data || null);
  }, []);

  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/scanner/session', fetchInit);
    const payload = await response.json();
    setUser(payload.user || null);
    setLoading(false);
    return payload.user as ScannerUser | null;
  }, []);

  const handleCredential = useCallback(
    async (credential: string) => {
      setError('');
      const response = await fetch('/api/scanner/auth/login', {
        ...fetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Sign-in failed.');
        return;
      }
      setUser(payload.user);
      await loadData();
    },
    [loadData],
  );

  const renderGoogleButton = useCallback(() => {
    const target = document.getElementById('google-signin-button');
    const googleId = getGoogleAccountsId();
    if (!target || !googleId || !googleClientId) return false;

    target.innerHTML = '';
    googleId.initialize({
      client_id: googleClientId,
      callback: (response) => handleCredential(response.credential),
    });
    googleId.renderButton(target, {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
    });
    return true;
  }, [googleClientId, handleCredential]);

  const tryRenderGoogleButton = useCallback(() => {
    if (user || !googleClientId) return;
    if (renderGoogleButton()) {
      renderAttemptsRef.current = 0;
      return;
    }
    if (renderAttemptsRef.current >= 12) return;
    renderAttemptsRef.current += 1;
    window.setTimeout(() => tryRenderGoogleButtonRef.current(), 250);
  }, [googleClientId, renderGoogleButton, user]);

  useEffect(() => {
    tryRenderGoogleButtonRef.current = tryRenderGoogleButton;
  }, [tryRenderGoogleButton]);

  const logout = useCallback(async () => {
    await fetch('/api/scanner/auth/logout', { ...fetchInit, method: 'POST' });
    setUser(null);
    setData(null);
    renderAttemptsRef.current = 0;
    window.setTimeout(tryRenderGoogleButton, 0);
  }, [tryRenderGoogleButton]);

  useEffect(() => {
    if (initialGoogleClientId) return;
    fetch('/api/scanner/config', fetchInit)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.googleClientId) setGoogleClientId(String(payload.googleClientId));
      })
      .catch(() => {
        // Keep empty client id; sign-in panel explains setup.
      });
  }, [initialGoogleClientId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshSession().then((sessionUser) => {
        if (sessionUser) loadData();
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData, refreshSession]);

  useEffect(() => {
    if (loading || user || !googleClientId || !googleScriptReady) return;
    renderAttemptsRef.current = 0;
    tryRenderGoogleButton();
  }, [googleClientId, googleScriptReady, loading, tryRenderGoogleButton, user]);

  const filteredNames = useMemo(
    () =>
      filterEbitdaNames(data?.names || [], {
        minDeltaPp,
        requireNonCollapsingRevenue,
        requireAbove200dma,
      }),
    [data?.names, minDeltaPp, requireNonCollapsingRevenue, requireAbove200dma],
  );

  const selected =
    filteredNames.find((name) => name.ticker === selectedTicker) || filteredNames[0] || null;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <ScannerExtrasNav active="/ebitda" />
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private research</p>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">EBITDA Margin Trend</h1>
              <p className="mt-3 max-w-3xl text-zinc-300">
                Rising EBITDA-margin watchlist with a Top Ten-style forward test by universe (NASDAQ-100, S&P 500 / SPY,
                Russell).
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/scanner/ledger"
                className="rounded-full border border-cyan-800 px-4 py-2 text-sm font-semibold text-cyan-200 hover:border-cyan-500"
              >
                Forward ledger
              </a>
              <a
                href="/scanner"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Back to scanner
              </a>
            </div>
          </div>
        </div>

        {loading ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Checking session...</section>
        ) : !user ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <Script
              src="https://accounts.google.com/gsi/client"
              strategy="afterInteractive"
              onLoad={() => {
                setGoogleScriptReady(true);
                window.setTimeout(tryRenderGoogleButton, 0);
              }}
            />
            <h2 className="mb-2 text-2xl font-semibold">Sign in</h2>
            <p className="mb-5 text-zinc-300">Use an approved Google account (same allowlist as the scanner).</p>
            {!googleClientId ? (
              <p className="rounded-xl border border-amber-700 bg-amber-950/60 p-4 text-amber-200">
                Google login is not configured yet. Add GOOGLE_OAUTH_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_CLIENT_ID) in Cloud
                Run, then redeploy or refresh this page.
              </p>
            ) : (
              <div id="google-signin-button" />
            )}
            {error && <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p>}
          </section>
        ) : (
          <div className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Expanding-margin names</h2>
                  <p className="text-sm text-zinc-400">
                    Logged in as {user.email}
                    {data?.generatedAt ? ` · data as of ${data.generatedAt}` : ''}
                    {data?.source ? ` · source ${data.source}` : ''}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
                >
                  Sign out
                </button>
              </div>

              <div className="mb-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-2 block text-zinc-400">Min margin delta (pp)</span>
                  <input
                    type="number"
                    value={minDeltaPp}
                    onChange={(event) => setMinDeltaPp(Number(event.target.value) || 0)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={requireNonCollapsingRevenue}
                    onChange={(event) => setRequireNonCollapsingRevenue(event.target.checked)}
                    className="size-4 accent-emerald-500"
                  />
                  Drop collapsing revenue
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={requireAbove200dma}
                    onChange={(event) => setRequireAbove200dma(event.target.checked)}
                    className="size-4 accent-emerald-500"
                  />
                  Require above 200-day
                </label>
              </div>

              {error && <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p>}

              {!filteredNames.length ? (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="text-lg font-semibold">No names match</h3>
                  <p className="mt-2 text-zinc-300">
                    {data?.message || data?.note || 'Try loosening filters, or wait for a live fundamentals upload.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-950 text-xs uppercase tracking-wide text-zinc-500">
                        <tr>
                          <th className="px-4 py-3">Ticker</th>
                          <th className="px-4 py-3">Δ margin</th>
                          <th className="px-4 py-3">Latest</th>
                          <th className="px-4 py-3">Rev YoY</th>
                          <th className="px-4 py-3">200d</th>
                          <th className="px-4 py-3">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredNames.map((name) => {
                          const active = name.ticker === selected?.ticker;
                          return (
                            <tr
                              key={name.ticker}
                              onClick={() => setSelectedTicker(name.ticker)}
                              className={`cursor-pointer border-t border-zinc-800 ${
                                active ? 'bg-emerald-950/40' : 'bg-zinc-900 hover:bg-zinc-900/80'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="font-semibold">{name.ticker}</div>
                                <div className="text-xs text-zinc-500">{name.name}</div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-emerald-300">{formatPp(name.marginDeltaPp)}</td>
                              <td className="px-4 py-3">{name.ebitdaMarginLatest.toFixed(1)}%</td>
                              <td className="px-4 py-3">{formatPct(name.revenueGrowthYoY)}</td>
                              <td className="px-4 py-3">
                                {name.above200dma === true ? 'Above' : name.above200dma === false ? 'Below' : 'n/a'}
                              </td>
                              <td className="px-4 py-3">
                                <MarginSparkline quarters={name.quarters} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {selected ? (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {selected.ticker} · {selected.name}
                          </h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            {selected.sector || 'Sector n/a'}
                            {selected.asOf ? ` · fundamentals as of ${selected.asOf}` : ''}
                          </p>
                        </div>
                        <div className="rounded-full border border-emerald-800 bg-emerald-950/50 px-3 py-1 text-sm text-emerald-200">
                          {formatPp(selected.marginDeltaPp)} vs prior
                        </div>
                      </div>
                      <p className="mt-4 text-zinc-300">{selected.why || 'No thesis note in payload.'}</p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <div className="text-2xl font-bold">{selected.ebitdaMarginLatest.toFixed(1)}%</div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Latest EBITDA margin</div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <div className="text-2xl font-bold">{selected.ebitdaMarginPrior.toFixed(1)}%</div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Prior EBITDA margin</div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <div className="text-2xl font-bold">{formatPct(selected.revenueGrowthYoY)}</div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Revenue YoY</div>
                        </div>
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                          <div className="text-2xl font-bold">
                            {selected.above200dma === true ? 'Yes' : selected.above200dma === false ? 'No' : 'n/a'}
                          </div>
                          <div className="text-xs uppercase tracking-wide text-zinc-500">Above 200-day</div>
                        </div>
                      </div>
                      {selected.quarters.length ? (
                        <div className="mt-5 overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="text-xs uppercase tracking-wide text-zinc-500">
                              <tr>
                                <th className="py-2 pr-4">Period</th>
                                <th className="py-2 pr-4">EBITDA margin</th>
                                <th className="py-2">Revenue ($M)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selected.quarters.map((quarter) => (
                                <tr key={quarter.period} className="border-t border-zinc-800">
                                  <td className="py-2 pr-4 font-medium">{quarter.period}</td>
                                  <td className="py-2 pr-4">{quarter.ebitdaMargin.toFixed(1)}%</td>
                                  <td className="py-2">
                                    {quarter.revenueM !== undefined ? quarter.revenueM.toLocaleString() : 'n/a'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold">How to use</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  Margin expansion is the tip. Trend confirmation (200-day) is the hold filter. This page is research-only
                  and intentionally separate from scanner buy lists.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                  {(data?.method || []).map((item) => (
                    <li key={item} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-xl font-semibold">Data</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {data?.note ||
                    'Live mode expects scanner/ebitda_margin_trends.json in the results bucket (or EBITDA_MARGINS_JSON_PATH).'}
                </p>
                <p className="mt-4 text-sm text-zinc-500">
                  Showing <span className="font-semibold text-emerald-300">{filteredNames.length}</span> of{' '}
                  {data?.names?.length || 0} names
                </p>
              </div>
            </aside>
          </div>
          <ForwardTestPanel forwardTest={data?.forwardTest} />
          </div>
        )}
      </div>
    </main>
  );
}
