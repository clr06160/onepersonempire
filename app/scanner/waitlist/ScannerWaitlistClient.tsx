'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type WaitlistEntry = {
  id: string;
  email: string;
  message: string;
  status: string;
  trustScore?: number;
  likelyBot?: boolean;
  signals?: string[];
  createdAt?: string;
  updatedAt?: string;
};

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

export default function ScannerWaitlistClient() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/waitlist', fetchInit);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || 'Could not load waitlist.');
      return;
    }
    setError('');
    setEntries(payload.entries || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <ScannerExtrasNav active="/scanner/waitlist" />
      <header className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">Developer</p>
        <h1 className="mt-2 text-3xl font-bold">Interest waitlist</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          People who dropped email + a note on the brochure before they have access. Approve them in Cloud Run /
          Firestore <code className="text-zinc-300">scannerUsers</code> when ready.
        </p>
      </header>

      {loading ? <p className="text-zinc-400">Loading…</p> : null}
      {error ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-200">
          {error}{' '}
          <Link href="/scanner" className="underline">
            Back
          </Link>
        </p>
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Trust</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-zinc-800 align-top">
                  <td className="px-4 py-3 font-mono text-emerald-200">{entry.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono text-sm ${
                        (entry.trustScore ?? 0) >= 70
                          ? 'text-emerald-400'
                          : (entry.trustScore ?? 0) >= 40
                            ? 'text-amber-300'
                            : 'text-red-300'
                      }`}
                    >
                      {entry.trustScore ?? '—'}
                    </span>
                    {entry.signals?.length ? (
                      <p className="mt-1 max-w-[10rem] text-[10px] text-zinc-500">{entry.signals.join(', ')}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 whitespace-pre-wrap">{entry.message || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {(entry.updatedAt || entry.createdAt || '').slice(0, 16).replace('T', ' ') || '—'}
                  </td>
                </tr>
              ))}
              {!entries.length ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    No interest notes yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
