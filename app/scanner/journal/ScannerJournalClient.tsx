'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type { JournalEntry, JournalLens } from '@/lib/scanner-journal-shared';
import { entryToMarkdown, formatMoney, formatPct, journalSummary } from '@/lib/scanner-journal-shared';

type ScannerUser = { email: string; role: string };
type FilterMode = 'all' | 'open' | 'closed';

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const LENS_OPTIONS: { value: JournalLens; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'top-ten', label: 'Top Ten' },
  { value: 'scanner', label: 'Scanner' },
  { value: 'agent', label: 'Agent' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'other', label: 'Other' },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function returnClass(value?: number | null) {
  if (value == null || Number.isNaN(value)) return 'text-zinc-400';
  if (value > 0) return 'text-emerald-300';
  if (value < 0) return 'text-red-300';
  return 'text-zinc-300';
}

const inputClass =
  'w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100';

function chartImageUrl(entryId: string, cacheKey?: string | null) {
  const base = `/api/scanner/journal/${entryId}/chart`;
  return cacheKey ? `${base}?v=${encodeURIComponent(cacheKey)}` : base;
}

function clipboardImageFile(event: ClipboardEvent): File | null {
  const item = Array.from(event.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
  if (!item) return null;
  return item.getAsFile();
}

function PasteHint({
  compact,
  hasImage,
  previewUrl,
}: {
  compact?: boolean;
  hasImage?: boolean;
  previewUrl?: string | null;
}) {
  if (previewUrl) {
    return (
      <img
        src={previewUrl}
        alt="Pasted chart screenshot"
        className={`rounded border border-emerald-700 object-cover ${compact ? 'h-10 w-16' : 'max-h-20'}`}
      />
    );
  }
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border border-dashed border-zinc-600 text-zinc-500 ${
        compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-2 text-xs'
      }`}
    >
      {hasImage ? 'Pasted' : 'Ctrl+V'}
    </span>
  );
}

function JournalChartPanel({
  entry,
  deleteChart,
  onMessage,
  onError,
}: {
  entry: JournalEntry;
  deleteChart: (entryId: string) => Promise<void>;
  onMessage: (text: string) => void;
  onError: (text: string) => void;
}) {
  const deleteForEntry = useCallback(async () => {
    try {
      await deleteChart(entry.id);
      onMessage(`Chart removed for ${entry.ticker}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not remove chart.');
    }
  }, [deleteChart, entry.id, entry.ticker, onError, onMessage]);

  const cacheKey = entry.updatedAt || entry.createdAt;

  return (
    <div className="w-full min-w-[280px] flex-1">
      <p className="text-xs uppercase text-zinc-500">Chart screenshot</p>
      {entry.hasChart ? (
        <div className="mt-2 space-y-2">
          <a href={chartImageUrl(entry.id, cacheKey)} target="_blank" rel="noreferrer">
            <img
              src={chartImageUrl(entry.id, cacheKey)}
              alt={`${entry.ticker} chart screenshot`}
              className="max-h-72 rounded-lg border border-zinc-800 object-contain"
            />
          </a>
          <p className="text-xs text-zinc-500">Paste again (Ctrl+V) to replace · or remove below.</p>
          <button
            type="button"
            onClick={() => void deleteForEntry()}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-500 hover:border-red-800 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="mt-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-4">
          <PasteHint />
          <p className="mt-2 text-xs text-zinc-500">
            Screenshot your chart (Win+Shift+S), then press <span className="text-zinc-300">Ctrl+V</span> anywhere on
            this page while this row is open.
          </p>
        </div>
      )}
    </div>
  );
}

export default function ScannerJournalClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [ticker, setTicker] = useState('');
  const [buyDate, setBuyDate] = useState(todayIso());
  const [buyAmount, setBuyAmount] = useState('');
  const [reason, setReason] = useState('');
  const [lens, setLens] = useState<JournalLens>('manual');
  const [pendingScreenshot, setPendingScreenshot] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  const [closeDrafts, setCloseDrafts] = useState<Record<string, { sellDate: string; sellAmount: string }>>({});

  useEffect(() => {
    if (!pendingScreenshot) {
      setPendingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingScreenshot);
    setPendingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingScreenshot]);

  const loadJournal = useCallback(async () => {
    const sessionResponse = await fetch('/api/scanner/session', fetchInit);
    const sessionPayload = await sessionResponse.json();
    setUser(sessionPayload.user || null);
    if (!sessionPayload.user) return;

    const response = await fetch('/api/scanner/journal', fetchInit);
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      setUser(null);
      return;
    }
    if (!response.ok) {
      setError(payload.error || 'Could not load journal.');
      return;
    }
    setError('');
    setEntries(payload.entries || []);
  }, []);

  useEffect(() => {
    loadJournal().finally(() => setLoading(false));
  }, [loadJournal]);

  const summary = useMemo(() => journalSummary(entries), [entries]);

  const visibleEntries = useMemo(() => {
    if (filter === 'open') return entries.filter((e) => e.status === 'open');
    if (filter === 'closed') return entries.filter((e) => e.status === 'closed');
    return entries;
  }, [entries, filter]);

  const uploadChart = useCallback(
    async (entryId: string, file: File) => {
      const form = new FormData();
      form.append('chart', file);
      const response = await fetch(`/api/scanner/journal/${entryId}/chart`, {
        ...fetchInit,
        method: 'POST',
        body: form,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not upload chart.');
      await loadJournal();
    },
    [loadJournal],
  );

  const deleteChart = useCallback(
    async (entryId: string) => {
      const response = await fetch(`/api/scanner/journal/${entryId}/chart`, { ...fetchInit, method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not remove chart.');
      await loadJournal();
    },
    [loadJournal],
  );

  useEffect(() => {
    const onPaste = async (event: ClipboardEvent) => {
      const file = clipboardImageFile(event);
      if (!file) return;
      event.preventDefault();
      setError('');
      if (expandedId) {
        try {
          await uploadChart(expandedId, file);
          const entry = entries.find((e) => e.id === expandedId);
          setMessage(`Chart saved for ${entry?.ticker || 'trade'}.`);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Paste failed.');
        }
        return;
      }
      setPendingScreenshot(file);
      setMessage('Screenshot pasted — click Add to save the trade.');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [entries, expandedId, uploadChart]);

  const handleAdd = useCallback(async () => {
    setSaving(true);
    setError('');
    setMessage('');
    const addedTicker = ticker.trim().toUpperCase();
    const screenshot = pendingScreenshot;
    try {
      const response = await fetch('/api/scanner/journal', {
        ...fetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, buyDate, buyAmount, reason, lens }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || 'Could not add trade.');
        return;
      }
      if (screenshot && payload.id) {
        try {
          await uploadChart(String(payload.id), screenshot);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Trade saved but screenshot upload failed.');
          await loadJournal();
          return;
        }
      }
      setTicker('');
      setBuyAmount('');
      setReason('');
      setBuyDate(todayIso());
      setPendingScreenshot(null);
      setMessage(
        screenshot && payload.id
          ? `Added ${addedTicker} with chart screenshot.`
          : `Added ${addedTicker}.`,
      );
      await loadJournal();
    } catch {
      setError('Could not add trade.');
    } finally {
      setSaving(false);
    }
  }, [buyAmount, buyDate, lens, loadJournal, pendingScreenshot, reason, ticker, uploadChart]);

  const patchEntry = useCallback(
    async (id: string, body: Record<string, unknown>) => {
      const response = await fetch(`/api/scanner/journal/${id}`, {
        ...fetchInit,
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save.');
      await loadJournal();
    },
    [loadJournal],
  );

  const handleClose = useCallback(
    async (entry: JournalEntry) => {
      const draft = closeDrafts[entry.id] || { sellDate: todayIso(), sellAmount: '' };
      setError('');
      try {
        await patchEntry(entry.id, {
          sellDate: draft.sellDate,
          sellAmount: draft.sellAmount,
        });
        setMessage(`${entry.ticker} closed.`);
        setCloseDrafts((current) => {
          const next = { ...current };
          delete next[entry.id];
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not close trade.');
      }
    },
    [closeDrafts, patchEntry],
  );

  const deleteEntry = useCallback(
    async (entry: JournalEntry) => {
      if (!window.confirm(`Delete ${entry.ticker}?`)) return;
      const response = await fetch(`/api/scanner/journal/${entry.id}`, { ...fetchInit, method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json();
        setError(payload.error || 'Could not delete.');
        return;
      }
      await loadJournal();
    },
    [loadJournal],
  );

  const copyAllForAi = useCallback(async () => {
    if (!entries.length) return;
    const markdown = entries.map(entryToMarkdown).join('\n\n');
    await navigator.clipboard.writeText(
      `# Trade journal (no account numbers)\n\n${markdown}`,
    );
    setMessage('Copied to clipboard for AI review.');
  }, [entries]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/journal" />

      <p className="mb-6 max-w-4xl text-sm text-zinc-400">
        Watchlist-style log — add buys with dollar amount. Screenshot your chart (Win+Shift+S), then{' '}
        <span className="text-zinc-300">Ctrl+V</span> to attach — no file picker. Fill sell date + sell $ to close.
      </p>

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first.</p>
          <Link href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner →
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {error ? <p className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">{error}</p> : null}
          {message ? (
            <p className="rounded-xl border border-emerald-900/60 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{message}</p>
          ) : null}

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-100">Trade watchlist</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {summary.openCount} open · {summary.closedCount} closed
                  {summary.closedWithPnl ? (
                    <>
                      {' '}
                      · realized {formatMoney(summary.realizedPnl)}
                      {summary.winRatePct != null ? ` · ${summary.winRatePct}% wins` : ''}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'open', 'closed'] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setFilter(mode)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                      filter === mode
                        ? 'border-emerald-600 bg-emerald-950 text-emerald-200'
                        : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
                {entries.length ? (
                  <button
                    type="button"
                    onClick={copyAllForAi}
                    className="rounded-full border border-zinc-600 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-400"
                  >
                    Copy for AI
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="min-w-[1040px] w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                    <th className="px-2 py-2">Ticker</th>
                    <th className="px-2 py-2">Buy date</th>
                    <th className="px-2 py-2">Buy $</th>
                    <th className="px-2 py-2">Sell date</th>
                    <th className="px-2 py-2">Sell $</th>
                    <th className="px-2 py-2">P&amp;L</th>
                    <th className="px-2 py-2">Return</th>
                    <th className="px-2 py-2">Why</th>
                    <th className="px-2 py-2">Chart</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-zinc-800/80 bg-zinc-950/50">
                    <td className="px-2 py-2">
                      <input
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        placeholder="ELF"
                        className={`${inputClass} font-mono uppercase`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input type="date" value={buyDate} onChange={(e) => setBuyDate(e.target.value)} className={inputClass} />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        placeholder="500"
                        inputMode="decimal"
                        className={`${inputClass} font-mono`}
                      />
                    </td>
                    <td className="px-2 py-2 text-zinc-600" colSpan={2}>
                      open
                    </td>
                    <td className="px-2 py-2 text-zinc-600">—</td>
                    <td className="px-2 py-2 text-zinc-600">—</td>
                    <td className="px-2 py-2">
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Top Ten, Flow ↑…"
                        className={inputClass}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <PasteHint compact previewUrl={pendingPreviewUrl} hasImage={Boolean(pendingScreenshot)} />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleAdd}
                        className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                      >
                        Add
                      </button>
                    </td>
                  </tr>

                  {visibleEntries.map((entry) => {
                    const draft = closeDrafts[entry.id] || { sellDate: todayIso(), sellAmount: '' };
                    const isOpen = entry.status === 'open';
                    const expanded = expandedId === entry.id;
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          className={`border-b border-zinc-800/60 ${isOpen ? 'bg-amber-950/10' : 'bg-zinc-900/40'}`}
                        >
                          <td className="px-2 py-2 font-mono font-semibold text-emerald-200">
                            <button type="button" className="text-left hover:underline" onClick={() => setExpandedId(expanded ? null : entry.id)}>
                              {entry.ticker}
                            </button>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-zinc-300">{entry.buyDate}</td>
                          <td className="px-2 py-2 font-mono text-zinc-200">{formatMoney(entry.buyAmount)}</td>
                          <td className="px-2 py-2">
                            {isOpen ? (
                              <input
                                type="date"
                                value={draft.sellDate}
                                onChange={(e) =>
                                  setCloseDrafts((c) => ({ ...c, [entry.id]: { ...draft, sellDate: e.target.value } }))
                                }
                                className={inputClass}
                              />
                            ) : (
                              <span className="text-zinc-300">{entry.sellDate}</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            {isOpen ? (
                              <input
                                value={draft.sellAmount}
                                onChange={(e) =>
                                  setCloseDrafts((c) => ({ ...c, [entry.id]: { ...draft, sellAmount: e.target.value } }))
                                }
                                placeholder="sell $"
                                inputMode="decimal"
                                className={`${inputClass} font-mono`}
                              />
                            ) : (
                              <span className="font-mono text-zinc-300">{formatMoney(entry.sellAmount)}</span>
                            )}
                          </td>
                          <td className={`px-2 py-2 font-mono ${returnClass(entry.pnlDollars)}`}>
                            {formatMoney(entry.pnlDollars)}
                          </td>
                          <td className={`px-2 py-2 font-mono ${returnClass(entry.returnPct)}`}>
                            {formatPct(entry.returnPct)}
                          </td>
                          <td className="max-w-[180px] truncate px-2 py-2 text-zinc-400" title={entry.reason}>
                            {entry.reason || '—'}
                          </td>
                          <td className="px-2 py-2">
                            {entry.hasChart ? (
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : entry.id)}
                                title="View chart screenshot"
                              >
                                <img
                                  src={chartImageUrl(entry.id, entry.updatedAt || entry.createdAt)}
                                  alt={`${entry.ticker} chart`}
                                  className="h-10 w-16 rounded border border-zinc-700 object-cover hover:border-emerald-600"
                                />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedId(entry.id)}
                                className="text-[11px] text-zinc-500 hover:text-zinc-300"
                                title="Open row, then Ctrl+V to paste screenshot"
                              >
                                Ctrl+V
                              </button>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex gap-1">
                              {isOpen ? (
                                <button
                                  type="button"
                                  onClick={() => handleClose(entry)}
                                  className="rounded border border-emerald-700 px-2 py-0.5 text-[11px] text-emerald-200"
                                >
                                  Close
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => deleteEntry(entry)}
                                className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-500"
                              >
                                Del
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-zinc-800/60 bg-zinc-950">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="flex flex-wrap items-start gap-4 text-sm">
                                <div>
                                  <p className="text-xs uppercase text-zinc-500">Lens</p>
                                  <p className="text-zinc-300 capitalize">{entry.lens?.replace('-', ' ') || 'manual'}</p>
                                </div>
                                <div className="min-w-[200px] flex-1">
                                  <p className="text-xs uppercase text-zinc-500">Reason</p>
                                  <p className="text-zinc-300">{entry.reason || '—'}</p>
                                  {entry.notes ? <p className="mt-1 text-zinc-500">{entry.notes}</p> : null}
                                </div>
                                <JournalChartPanel
                                  entry={entry}
                                  deleteChart={deleteChart}
                                  onMessage={setMessage}
                                  onError={setError}
                                />
                                <div className="flex flex-wrap gap-2 self-start pt-5">
                                  <TickerLink ticker={entry.ticker} className="text-emerald-300" />
                                  <Link href={`/scanner/charts?ticker=${entry.ticker}`} className="text-zinc-400 hover:text-zinc-200">
                                    Live chart
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!visibleEntries.length ? (
              <p className="mt-4 text-sm text-zinc-500">No trades yet — use the top row to add a buy.</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              <label>
                Default lens for new rows:
                <select
                  value={lens}
                  onChange={(e) => setLens(e.target.value as JournalLens)}
                  className="ml-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-300"
                >
                  {LENS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <span>Ctrl+V to paste chart · open a row to paste onto existing trade · new row uses top paste</span>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
