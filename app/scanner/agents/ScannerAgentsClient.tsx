'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import PickNameRow from '@/components/scanner/PickNameRow';
import type { PickContext } from '@/lib/scanner-pick-context';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type { AgentDetail, AgentLeaderboardRow, AgentTrade, ScannerAgentsPayload } from '@/lib/scanner-agents';

type ScannerUser = {
  email: string;
  role: 'viewer' | 'developer';
};

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function returnTone(pct: number) {
  if (pct > 0) return 'text-emerald-400';
  if (pct < 0) return 'text-red-400';
  return 'text-zinc-300';
}

function tradeSummary(trade: AgentTrade) {
  if (trade.type === 'EXPOSURE') {
    return `Exposure ${trade.previousExposurePct ?? '?'}% → ${trade.exposurePct ?? '?'}% · ${trade.reason || ''}`;
  }
  const added = trade.added?.length ? `+${trade.added.join(', ')}` : '';
  const removed = trade.removed?.length ? `−${trade.removed.join(', ')}` : '';
  return [added, removed].filter(Boolean).join(' · ') || 'Holdings updated';
}

export default function ScannerAgentsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ScannerAgentsPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [pickContextByTicker, setPickContextByTicker] = useState<Record<string, PickContext>>({});

  const loadAgents = useCallback(async () => {
    const [sessionResponse, agentsResponse, pickResponse] = await Promise.all([
      fetch('/api/scanner/session', fetchInit),
      fetch('/api/scanner/agents', fetchInit),
      fetch('/api/scanner/pick-context', fetchInit),
    ]);
    const sessionPayload = await sessionResponse.json();
    setUser(sessionPayload.user || null);

    const payload = await agentsResponse.json();
    if (!agentsResponse.ok) {
      setError(payload.error || 'Could not load agent tournament.');
      return;
    }
    const pickPayload = pickResponse.ok ? await pickResponse.json() : { data: { byTicker: {} } };
    setError('');
    setData(payload.data || null);
    setPickContextByTicker(pickPayload.data?.byTicker || {});
    const rows = (payload.data?.leaderboard || []) as AgentLeaderboardRow[];
    if (rows.length) {
      setSelectedId((current) => current || rows[0].agentId);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadAgents().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAgents]);

  const selected = useMemo(() => {
    if (!data?.agents || !selectedId) return null;
    return data.agents[selectedId] as AgentDetail | undefined;
  }, [data, selectedId]);

  const leaderboard = data?.leaderboard || [];
  const initial = data?.initialCapital ?? 100_000;
  const agentCount = data?.agentCount ?? leaderboard.length;

  const roleFilters = useMemo(() => {
    const roles = new Set<string>();
    for (const row of leaderboard) {
      if (row.role) roles.add(row.role);
    }
    return ['All', ...Array.from(roles).sort((a, b) => a.localeCompare(b))];
  }, [leaderboard]);

  const filteredLeaderboard = useMemo(() => {
    if (roleFilter === 'All') return leaderboard;
    return leaderboard.filter((row) => row.role === roleFilter);
  }, [leaderboard, roleFilter]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/agents" />

      {data?.generatedAt ? (
        <p className="mb-6 text-sm text-zinc-400">
          Crew updated: <span className="font-semibold text-violet-300">{data.generatedAt}</span>
          {data.asOf ? (
            <>
              {' '}
              · picks as of <span className="text-zinc-200">{data.asOf}</span>
            </>
          ) : null}
          {data.crewStartDate ? <> · started {data.crewStartDate}</> : null}
          {agentCount ? <> · {agentCount} agents (one per scan)</> : null}
        </p>
      ) : null}

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading tournament…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first.</p>
          <Link href="/scanner" className="mt-4 inline-flex text-violet-300 hover:text-violet-200">
            Go to scanner sign-in →
          </Link>
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-red-800 bg-red-950/50 p-6 text-red-200">{error}</section>
      ) : !leaderboard.length ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">{data?.message || 'No agent data yet.'}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Run <code className="text-violet-300">python scanner_agent_crew.py --upload</code> after a scanner refresh.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Leaderboard · ${formatMoney(initial)} each · follows scanner rules daily
              </p>
              {roleFilters.length > 2 ? (
                <div className="flex flex-wrap gap-1.5">
                  {roleFilters.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRoleFilter(role)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        roleFilter === role
                          ? 'border border-violet-600 bg-violet-950/60 text-violet-200'
                          : 'border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Return</th>
                    <th className="px-3 py-2">Equity</th>
                    <th className="px-3 py-2">Max DD</th>
                    <th className="px-3 py-2">Days</th>
                    <th className="px-3 py-2">Exposure</th>
                    <th className="px-3 py-2">Backtest ref</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((row) => (
                    <tr
                      key={row.agentId}
                      className={`cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/60 ${
                        selectedId === row.agentId ? 'bg-violet-950/30' : ''
                      }`}
                      onClick={() => setSelectedId(row.agentId)}
                    >
                      <td className="px-3 py-3 font-mono text-zinc-400">{row.rank}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-zinc-100">{row.label}</p>
                        <p className="text-xs text-zinc-500">
                          {row.role}
                          {row.isHoldVariant ? ' · hold basket' : ''}
                          {row.usesLedgerHoldings ? ' · ledger hold' : ''}
                          {row.holdSince ? ` · since ${row.holdSince.slice(0, 10)}` : ''}
                        </p>
                      </td>
                      <td className={`px-3 py-3 font-mono font-semibold ${returnTone(row.totalReturnPct)}`}>
                        {row.totalReturnPct > 0 ? '+' : ''}
                        {row.totalReturnPct.toFixed(2)}%
                      </td>
                      <td className="px-3 py-3 font-mono">${formatMoney(row.equity)}</td>
                      <td className="px-3 py-3 font-mono text-red-300">{row.maxDrawdownPct.toFixed(2)}%</td>
                      <td className="px-3 py-3 font-mono text-zinc-400">{row.daysLive}</td>
                      <td className="px-3 py-3 font-mono text-zinc-300">{row.exposurePct}%</td>
                      <td className="px-3 py-3 text-xs text-zinc-500">
                        {row.backtestCagr || '—'} / {row.backtestMaxDd || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <h2 className="text-xl font-semibold">{selected.label}</h2>
                {selected.isHoldVariant || selected.usesLedgerHoldings ? (
                  <p className="mt-2 inline-flex rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
                    {selected.usesLedgerHoldings ? 'Live ledger hold' : 'Scheduled hold basket'}
                    {selected.holdSince ? ` · since ${selected.holdSince.slice(0, 10)}` : ''}
                    {selected.holdCadenceLabel ? ` · ${selected.holdCadenceLabel}` : ''}
                  </p>
                ) : null}
                {selected.regimeBadge ? (
                  <span className="mt-2 inline-block rounded-full border border-violet-800 bg-violet-950/50 px-3 py-1 text-xs font-semibold text-violet-200">
                    {selected.regimeBadge}
                  </span>
                ) : null}
                <p className="mt-2 text-sm text-zinc-400">{selected.exposureReason}</p>
                <div className="mt-4 space-y-2">
                  {(selected.holdings || []).map((ticker, index) => (
                    <PickNameRow
                      key={ticker}
                      ticker={ticker}
                      index={index}
                      context={pickContextByTicker[ticker]}
                    />
                  ))}
                </div>
                <p className="mt-4 text-sm text-zinc-500">
                  {selected.holdings?.length || 0} names · equal weight · exposure {selected.exposurePct}%
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Performance</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Equity</dt>
                    <dd className="font-mono font-semibold">${formatMoney(selected.metrics.equity)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">
                      {selected.isHoldVariant || selected.usesLedgerHoldings
                        ? `Hold return${selected.holdSince ? ` (since ${selected.holdSince.slice(0, 10)})` : ''}`
                        : 'Return'}
                    </dt>
                    <dd className={`font-mono font-semibold ${returnTone(selected.metrics.totalReturnPct)}`}>
                      {selected.metrics.totalReturnPct > 0 ? '+' : ''}
                      {selected.metrics.totalReturnPct.toFixed(2)}%
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Max drawdown</dt>
                    <dd className="font-mono text-red-300">{selected.metrics.maxDrawdownPct.toFixed(2)}%</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Trading days</dt>
                    <dd className="font-mono">{selected.metrics.days}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Recent trades & events</h3>
                {(selected.trades || []).length ? (
                  <ul className="mt-3 space-y-3">
                    {(selected.trades || []).map((trade, index) => (
                      <li
                        key={`${trade.date}-${trade.type}-${index}`}
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-zinc-400">{trade.date}</span>
                          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs uppercase text-zinc-300">
                            {trade.type}
                          </span>
                        </div>
                        <p className="mt-1 text-zinc-300">{tradeSummary(trade)}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">No trades logged yet — run daily to accumulate history.</p>
                )}
              </div>
            </section>
          ) : null}

          {data?.note ? (
            <p className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-sm text-zinc-500">{data.note}</p>
          ) : null}
        </div>
      )}
    </>
  );
}
