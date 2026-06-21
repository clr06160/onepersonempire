'use client';

import { useCallback, useEffect, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type { CotMarketRow, CotReportPayload } from '@/lib/scanner-cot-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function MarketTable({ title, rows }: { title: string; rows: CotMarketRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={`${title}-${row.market}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-900 px-3 py-2">
            <span className="font-medium text-zinc-200">{row.market}</span>
            <span className={row.signal === 'LONG' ? 'text-emerald-300' : 'text-red-300'}>{row.signal}</span>
            <span className="text-sm text-zinc-400">
              net {row.specNet.toLocaleString()} · ch {row.specNetChange.toLocaleString()} · {row.netPctOi ?? '—'}% OI
            </span>
            {row.extreme ? <span className="text-xs text-amber-300">extreme</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CotReportClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<CotReportPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/cot', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load COT report.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData(payload.data || null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const overall = data?.equitiesOverall;

  return (
    <>
      <ScannerExtrasNav active="/scanner/cot" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading COT report...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold">COT Positioning</h2>
            <p className="text-sm text-zinc-400">
              Report date: {data?.reportDate || 'n/a'} · logged in as {user.email}
            </p>
            {data?.generatedAt ? (
              <p className="text-xs text-zinc-500">Snapshot {new Date(data.generatedAt).toLocaleString()}</p>
            ) : null}
            {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}
            {data?.message && !data?.equities?.length ? (
              <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
            ) : null}
          </section>

          {overall ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold">Equities overall</h3>
              <p className="mt-2 text-zinc-300">
                {overall.signal} · weighted net {overall.weightedNet.toLocaleString()} · change{' '}
                {overall.netChange.toLocaleString()} ({overall.changeTone})
              </p>
            </section>
          ) : null}

          <MarketTable title="Equity index futures (leveraged funds)" rows={data?.equities || []} />
          <MarketTable title="Energy (managed money)" rows={data?.commodities?.energy || []} />
          <MarketTable title="Metals (managed money)" rows={data?.commodities?.metals || []} />

          {data?.note ? <p className="text-sm text-zinc-500">{data.note}</p> : null}
          {data?.discoveryStatus ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">{data.discoveryStatus}</p>
          ) : null}
        </div>
      )}
    </>
  );
}
