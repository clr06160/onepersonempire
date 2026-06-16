'use client';

import Script from 'next/script';
import { useCallback, useEffect, useState } from 'react';

type ScannerUser = {
  email: string;
  name?: string;
  picture?: string;
  role: 'viewer' | 'developer';
};

type ScannerData = {
  connected?: boolean;
  generatedAt?: string;
  message?: string;
  systems?: ScannerSystem[];
};

type ScannerSystem = {
  id: string;
  label: string;
  role: string;
  stats?: Record<string, string>;
  date?: string;
  top?: string[];
  watchDate?: string;
  watch?: string[];
  method?: string[];
  note?: string;
  isLive?: boolean;
  asOf?: string;
  powertrend?: string;
  powertrendOn?: boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
  }
}

const googleClientIdFromBuild = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

const scannerFetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

export default function ScannerPage() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ScannerData | null>(null);
  const [developerMessage, setDeveloperMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [googleClientId, setGoogleClientId] = useState(googleClientIdFromBuild);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [scannerFileCount, setScannerFileCount] = useState(0);

  const loadScannerData = useCallback(async () => {
    const response = await fetch('/api/scanner/data', scannerFetchInit);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Could not load scanner data.');
      return;
    }
    setUser(payload.user || null);
    setData(payload.data || null);
    const systems = (payload.data?.systems || []) as ScannerSystem[];
    if (systems.length) setSelectedSystemId((current) => current || systems[0].id);
  }, []);

  const refreshSession = useCallback(async () => {
    const response = await fetch('/api/scanner/session', scannerFetchInit);
    const payload = await response.json();
    setUser(payload.user || null);
    setLoading(false);
    return payload.user as ScannerUser | null;
  }, []);

  const loadDeveloperTools = useCallback(async () => {
    const response = await fetch('/api/scanner/developer', scannerFetchInit);
    const payload = await response.json();
    setDeveloperMessage(payload.message || payload.error || '');
    setDownloadUrl(payload.downloadUrl || '');
    setScannerFileCount(Number(payload.scannerCount || 0));
  }, []);

  const handleCredential = useCallback(async (credential: string) => {
    setError('');
    const response = await fetch('/api/scanner/auth/login', {
      ...scannerFetchInit,
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
    await loadScannerData();
  }, [loadScannerData]);

  const renderGoogleButton = useCallback(() => {
    const target = document.getElementById('google-signin-button');
    if (!target || !window.google || !googleClientId) return;
    target.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => handleCredential(response.credential),
    });
    window.google.accounts.id.renderButton(target, {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
    });
  }, [googleClientId, handleCredential]);

  const logout = useCallback(async () => {
    await fetch('/api/scanner/auth/logout', { ...scannerFetchInit, method: 'POST' });
    setUser(null);
    setData(null);
    setDeveloperMessage('');
    setTimeout(renderGoogleButton, 0);
  }, [renderGoogleButton]);

  useEffect(() => {
    if (googleClientIdFromBuild) return;
    fetch('/api/scanner/config', scannerFetchInit)
      .then((response) => response.json())
      .then((payload) => {
        if (payload.googleClientId) setGoogleClientId(String(payload.googleClientId));
      })
      .catch(() => {
        // Keep the default empty state; the sign-in panel shows setup instructions.
      });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshSession().then((sessionUser) => {
        if (sessionUser) loadScannerData();
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadScannerData, refreshSession]);

  useEffect(() => {
    if (!loading && !user && googleClientId) renderGoogleButton();
  }, [googleClientId, loading, renderGoogleButton, user]);

  useEffect(() => {
    if (user?.role !== 'developer') return;
    const timer = window.setTimeout(() => {
      loadDeveloperTools();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDeveloperTools, user?.role]);

  const systems = data?.systems || [];
  const selectedSystem = systems.find((system) => system.id === selectedSystemId) || systems[0];

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner</p>
          <h1 className="text-4xl font-bold tracking-tight">OnePersonEmpire Stock Scanner</h1>
        </div>

        {loading ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Checking session...</section>
        ) : !user ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <Script src="https://accounts.google.com/gsi/client" async defer onLoad={renderGoogleButton} />
            <h2 className="mb-2 text-2xl font-semibold">Sign in</h2>
            <p className="mb-5 text-zinc-300">Use an approved Google account to open the scanner.</p>
            {!googleClientId ? (
              <p className="rounded-xl border border-amber-700 bg-amber-950/60 p-4 text-amber-200">
                Google login is not configured yet. Add GOOGLE_OAUTH_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_CLIENT_ID) in Cloud Run, then redeploy or refresh this page.
              </p>
            ) : (
              <div id="google-signin-button" />
            )}
            {error && <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p>}
          </section>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Scanner Dashboard</h2>
                  <p className="text-sm text-zinc-400">Logged in as {user.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
                >
                  Sign out
                </button>
              </div>

              {selectedSystem ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                        selectedSystem.powertrendOn
                          ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                          : 'border-red-800 bg-red-950 text-red-200'
                      }`}
                    >
                      {selectedSystem.powertrend || 'POWER TREND UNKNOWN'}
                    </span>
                    <span className="text-sm text-zinc-400">
                      {selectedSystem.isLive ? 'Live scan' : 'Saved scan'} · as of {selectedSystem.asOf || selectedSystem.date || 'n/a'}
                    </span>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-zinc-300">Scanner</span>
                    <select
                      value={selectedSystem.id}
                      onChange={(event) => setSelectedSystemId(event.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                    >
                      {systems.map((system) => (
                        <option key={system.id} value={system.id}>
                          {system.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {Object.entries(selectedSystem.stats || {}).map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <div className="text-2xl font-bold">{value}</div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                    <h3 className="text-lg font-semibold">{selectedSystem.label}</h3>
                    <p className="mt-2 text-zinc-300">{selectedSystem.note}</p>
                    <p className="mt-2 text-sm text-zinc-500">Saved rebalance date: {selectedSystem.date || 'n/a'}</p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                      <h3 className="mb-3 text-lg font-semibold">Top Names</h3>
                      <div className="space-y-2">
                        {(selectedSystem.top || []).map((ticker, index) => (
                          <div
                            key={`${ticker}-${index}`}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                              index < 3 ? 'bg-emerald-950/50 text-emerald-200' : 'bg-zinc-900 text-zinc-200'
                            }`}
                          >
                            <span>#{index + 1}</span>
                            <span className="font-semibold">{ticker}</span>
                            <span className="text-xs text-zinc-400">{index < 3 ? 'Highest priority' : 'Portfolio name'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {!!selectedSystem.watch?.length && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                        <h3 className="mb-1 text-lg font-semibold">Weekly Basket If PowerTrend ON</h3>
                        <p className="mb-3 text-sm text-zinc-500">Weekly date: {selectedSystem.watchDate || 'n/a'}</p>
                        <div className="space-y-2">
                          {selectedSystem.watch.map((ticker, index) => (
                            <div key={`${ticker}-${index}`} className="flex items-center justify-between rounded-lg bg-zinc-900 px-3 py-2">
                              <span>#{index + 1}</span>
                              <span className="font-semibold">{ticker}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="text-lg font-semibold">Scanner data</h3>
                  <p className="mt-2 text-zinc-300">
                    {data?.message || 'Scanner data will appear here after the stock project exports web results.'}
                  </p>
                  <p className="mt-4 text-sm text-zinc-500">
                    Access level: <span className="font-semibold text-emerald-300">{user.role}</span>
                  </p>
                </div>
              )}
            </section>

            <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-xl font-semibold">Access</h2>
              <p className="mt-2 text-sm text-zinc-400">
                This page is tied to the signed-in Google account, not a shared password.
              </p>
              {user.role === 'developer' ? (
                <div className="mt-5 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4">
                  <h3 className="font-semibold text-emerald-200">Developer tools</h3>
                  <p className="mt-2 text-sm text-emerald-100">{developerMessage || 'Developer access confirmed.'}</p>
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      className="mt-4 inline-flex rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
                    >
                      Download scanner zip{scannerFileCount ? ` (${scannerFileCount} scanners)` : ''}
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="font-semibold">Viewer account</h3>
                  <p className="mt-2 text-sm text-zinc-400">This account can view scanner results but cannot download code.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
