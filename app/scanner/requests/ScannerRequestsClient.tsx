'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

type ScannerRole = 'viewer' | 'developer';

type ScannerUser = {
  email: string;
  name?: string;
  role: ScannerRole;
};

type ScannerRequest = {
  id: string;
  title: string;
  details: string;
  status: string;
  submittedByName?: string;
  submittedByRole?: ScannerRole;
  createdAt?: string | null;
};

type ScannerTestResult = {
  id: string;
  requestId?: string;
  title: string;
  summary: string;
  metrics?: string;
  caveats?: string;
  submittedByName?: string;
  createdAt?: string | null;
};

const scannerFetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function formatRequestDate(value?: string | null) {
  if (!value) return '';
  return new Date(value).toLocaleDateString();
}

export default function ScannerRequestsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [scanRequests, setScanRequests] = useState<ScannerRequest[]>([]);
  const [testResults, setTestResults] = useState<ScannerTestResult[]>([]);
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDetails, setRequestDetails] = useState('');
  const [resultRequestId, setResultRequestId] = useState('');
  const [resultTitle, setResultTitle] = useState('');
  const [resultSummary, setResultSummary] = useState('');
  const [resultMetrics, setResultMetrics] = useState('');
  const [resultCaveats, setResultCaveats] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resultSubmitting, setResultSubmitting] = useState(false);

  const loadScanRequests = useCallback(async () => {
    const response = await fetch('/api/scanner/requests', scannerFetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load scan requests.');
      return;
    }
    setError('');
    setUser((payload.user || null) as ScannerUser | null);
    setScanRequests((payload.requests || []) as ScannerRequest[]);
    setTestResults((payload.results || []) as ScannerTestResult[]);
  }, []);

  const submitScanRequest = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSubmitting(true);
      setError('');
      setMessage('');

      const response = await fetch('/api/scanner/requests', {
        ...scannerFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: requestTitle, details: requestDetails }),
      });
      const payload = await response.json();
      setSubmitting(false);

      if (!response.ok) {
        setError(payload.error || 'Could not submit scan request.');
        return;
      }

      setRequestTitle('');
      setRequestDetails('');
      setMessage('Scan request posted. It will be reviewed before anything runs.');
      await loadScanRequests();
    },
    [loadScanRequests, requestDetails, requestTitle],
  );

  const submitTestResult = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setResultSubmitting(true);
      setError('');
      setMessage('');

      const response = await fetch('/api/scanner/requests/results', {
        ...scannerFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: resultRequestId,
          title: resultTitle,
          summary: resultSummary,
          metrics: resultMetrics,
          caveats: resultCaveats,
        }),
      });
      const payload = await response.json();
      setResultSubmitting(false);

      if (!response.ok) {
        setError(payload.error || 'Could not submit test result.');
        return;
      }

      setResultRequestId('');
      setResultTitle('');
      setResultSummary('');
      setResultMetrics('');
      setResultCaveats('');
      setMessage('Developer test result posted for review.');
      await loadScanRequests();
    },
    [loadScanRequests, resultCaveats, resultMetrics, resultRequestId, resultSummary, resultTitle],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadScanRequests();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadScanRequests]);

  const requestTitles = new Map(scanRequests.map((request) => [request.id, request.title]));

  return (
    <div className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-2xl font-semibold">Request a scan</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Describe a scanner or backtest idea. This is a human-reviewed board; no user request runs automatically.
        </p>

        <form onSubmit={submitScanRequest} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">Short title</span>
            <input
              value={requestTitle}
              onChange={(event) => setRequestTitle(event.target.value)}
              maxLength={120}
              placeholder="High growth pullbacks"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">What should it find?</span>
            <textarea
              value={requestDetails}
              onChange={(event) => setRequestDetails(event.target.value)}
              maxLength={2500}
              rows={9}
              placeholder="Example: Nasdaq 100 stocks with strong 3-month momentum, good revenue growth, and a pullback near the 21-day average."
              className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {submitting ? 'Posting...' : 'Post scan request'}
          </button>
        </form>

        {user?.role === 'developer' && (
          <div className="mt-6 rounded-2xl border border-emerald-900 bg-emerald-950/20 p-5">
            <h2 className="text-xl font-semibold text-emerald-100">Post developer results</h2>
            <p className="mt-2 text-sm text-emerald-100/80">
              Use this after testing a request locally. These notes help decide what should be added to the real scanner.
            </p>

            <form onSubmit={submitTestResult} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-emerald-100">Related request</span>
                <select
                  value={resultRequestId}
                  onChange={(event) => setResultRequestId(event.target.value)}
                  className="w-full rounded-xl border border-emerald-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
                >
                  <option value="">General / not tied to one request</option>
                  {scanRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-emerald-100">What did you test?</span>
                <input
                  value={resultTitle}
                  onChange={(event) => setResultTitle(event.target.value)}
                  maxLength={140}
                  placeholder="Weekly stochastic pullback test"
                  className="w-full rounded-xl border border-emerald-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-emerald-100">Results summary</span>
                <textarea
                  value={resultSummary}
                  onChange={(event) => setResultSummary(event.target.value)}
                  maxLength={3000}
                  rows={6}
                  placeholder="Explain what data, rules, and time period were tested, plus the result."
                  className="w-full resize-none rounded-xl border border-emerald-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-emerald-100">Metrics</span>
                <textarea
                  value={resultMetrics}
                  onChange={(event) => setResultMetrics(event.target.value)}
                  maxLength={3000}
                  rows={4}
                  placeholder="CAGR, max drawdown, win/loss years, exposure, benchmark, etc."
                  className="w-full resize-none rounded-xl border border-emerald-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-emerald-100">Caveats / problems found</span>
                <textarea
                  value={resultCaveats}
                  onChange={(event) => setResultCaveats(event.target.value)}
                  maxLength={3000}
                  rows={4}
                  placeholder="Look-ahead risks, bad math, too much drawdown, overfitting, or why it may still be useful."
                  className="w-full resize-none rounded-xl border border-emerald-800 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </label>

              <button
                type="submit"
                disabled={resultSubmitting}
                className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {resultSubmitting ? 'Posting results...' : 'Post developer results'}
              </button>
            </form>
          </div>
        )}

        {message && <p className="mt-4 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4 text-sm text-emerald-100">{message}</p>}
        {error && <p className="mt-4 rounded-xl border border-red-800 bg-red-950/50 p-4 text-sm text-red-200">{error}</p>}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Scan board</h2>
            <p className="mt-1 text-sm text-zinc-400">Latest scanner ideas from approved users.</p>
          </div>
          <button onClick={loadScanRequests} className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500">
            Refresh
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {loading ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-400">Loading scan requests...</p>
          ) : scanRequests.length ? (
            scanRequests.map((request) => (
              <article key={request.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-100">{request.title}</h3>
                  <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase tracking-wide text-zinc-400">
                    {request.status}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-zinc-300">{request.details}</p>
                <p className="mt-4 text-xs text-zinc-500">
                  {request.submittedByName || 'Scanner user'}
                  {request.submittedByRole === 'developer' ? ' · developer' : ''}
                  {formatRequestDate(request.createdAt) ? ` · ${formatRequestDate(request.createdAt)}` : ''}
                </p>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-500">No scan requests yet.</p>
          )}
        </div>

        <div className="mt-8 border-t border-zinc-800 pt-6">
          <h2 className="text-2xl font-semibold">Developer test results</h2>
          <p className="mt-1 text-sm text-zinc-400">Notes from developers who tested scanner ideas locally.</p>

          <div className="mt-5 space-y-4">
            {testResults.length ? (
              testResults.map((result) => (
                <article key={result.id} className="rounded-xl border border-emerald-900/70 bg-emerald-950/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-emerald-100">{result.title}</h3>
                      {result.requestId && requestTitles.get(result.requestId) ? (
                        <p className="mt-1 text-xs text-emerald-200/70">Related request: {requestTitles.get(result.requestId)}</p>
                      ) : null}
                    </div>
                    <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs uppercase tracking-wide text-emerald-200">
                      tested
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-zinc-200">{result.summary}</p>
                  {result.metrics ? (
                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                      <h4 className="text-sm font-semibold text-zinc-300">Metrics</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{result.metrics}</p>
                    </div>
                  ) : null}
                  {result.caveats ? (
                    <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                      <h4 className="text-sm font-semibold text-zinc-300">Caveats</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{result.caveats}</p>
                    </div>
                  ) : null}
                  <p className="mt-4 text-xs text-zinc-500">
                    {result.submittedByName || 'Developer'}
                    {formatRequestDate(result.createdAt) ? ` · ${formatRequestDate(result.createdAt)}` : ''}
                  </p>
                </article>
              ))
            ) : (
              <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-500">No developer test results yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
