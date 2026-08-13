'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  DayTradeBounceFailArmor,
  DayTradeBounceTierBacktest,
  DayTradeBounceTierGuide,
  DayTradeCutoffRow,
  DayTradeHistoricalStats,
  DayTradeHistMetric,
  DayTradePair,
  DayTradePayload,
  DayTradePrimarySignal,
  DayTradeSoxsFailedBounce,
  DayTradeTicker,
} from '@/lib/scanner-daytrade-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function toneClass(tone?: string) {
  if (tone === 'buy') return 'border-emerald-600 bg-emerald-950/50 text-emerald-200';
  if (tone === 'watch') return 'border-amber-600 bg-amber-950/40 text-amber-200';
  if (tone === 'fade') return 'border-orange-700 bg-orange-950/40 text-orange-200';
  return 'border-zinc-700 bg-zinc-900/80 text-zinc-300';
}

function setupBadge(setup: string) {
  if (setup === 'BOUNCE') return 'bg-emerald-600 text-white';
  if (setup === 'WATCH') return 'bg-amber-600 text-zinc-950';
  if (setup === 'FADE' || setup === 'EXTENDED') return 'bg-orange-600 text-zinc-950';
  return 'bg-zinc-700 text-zinc-200';
}

function scoreBar(score: number, color: string) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
    </div>
  );
}

function HistMetric({ label, m }: { label: string; m?: DayTradeHistMetric }) {
  if (!m?.avgPct && m?.avgPct !== 0) return null;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-zinc-100">
        avg {m.avgPct !== undefined && m.avgPct >= 0 ? '+' : ''}
        {m.avgPct}% · med {m.medianPct !== undefined && m.medianPct >= 0 ? '+' : ''}
        {m.medianPct}%
      </div>
      <div className="text-xs text-zinc-500">
        win {m.winRatePct}%
        {m.p75Pct !== undefined ? ` · p75 ${m.p75Pct >= 0 ? '+' : ''}${m.p75Pct}%` : ''}
      </div>
    </div>
  );
}

function signalClass(action?: string) {
  if (action === 'BUY') return 'border-emerald-500 bg-emerald-600/20 text-emerald-100';
  if (action === 'EXIT') return 'border-sky-500 bg-sky-600/15 text-sky-100';
  if (action === 'WAIT') return 'border-amber-500 bg-amber-600/15 text-amber-100';
  return 'border-zinc-600 bg-zinc-800/80 text-zinc-300';
}

function signalBadgeClass(action?: string) {
  if (action === 'BUY') return 'bg-emerald-600 text-white';
  if (action === 'EXIT') return 'bg-sky-600 text-white';
  if (action === 'WAIT') return 'bg-amber-600 text-zinc-950';
  return 'bg-zinc-700 text-zinc-200';
}

function formatSignalDate(iso?: string) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function PrimarySignalBanner({ signal }: { signal?: DayTradePrimarySignal | null }) {
  if (!signal) return null;
  const signalDate = formatSignalDate(signal.signalAsOf);
  const label =
    signal.executionPhase === 'EXIT'
      ? signalDate
        ? `Bounce day · crash signal ${signalDate}`
        : 'Bounce day'
      : signalDate
        ? `Crash signal · ${signalDate}`
        : "Today's setup";
  const showPlan = signal.action === 'BUY' || signal.action === 'EXIT';
  return (
    <section
      className={`mb-8 rounded-2xl border-2 p-6 ${signalClass(signal.action)}`}
      aria-live="polite"
    >
      <div className="text-xs font-bold uppercase tracking-widest opacity-80">{label}</div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight">{signal.headline}</h2>
      {signal.sub ? <p className="mt-2 text-base opacity-90">{signal.sub}</p> : null}
      {showPlan ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {signal.entry ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide opacity-70">Entry</div>
              <div className="mt-1 text-sm font-medium">{signal.entry}</div>
            </div>
          ) : null}
          {signal.exit ? (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide opacity-70">Exit</div>
              <div className="mt-1 text-sm font-medium">{signal.exit}</div>
            </div>
          ) : null}
        </div>
      ) : null}
      {signal.sizeHint ? (
        <p className="mt-3 text-sm font-semibold opacity-90">Size: {signal.sizeHint}</p>
      ) : null}
    </section>
  );
}

function soxsSignalClass(action?: string) {
  if (action === 'BUY') return 'border-emerald-500 bg-emerald-950/40 text-emerald-100';
  if (action === 'ARMED') return 'border-amber-500 bg-amber-950/40 text-amber-100';
  if (action === 'SELL') return 'border-sky-500 bg-sky-950/40 text-sky-100';
  if (action === 'HOLD') return 'border-violet-500 bg-violet-950/30 text-violet-100';
  return 'border-zinc-700 bg-zinc-900/70 text-zinc-200';
}

function SoxsFailedBouncePanel({ strategy }: { strategy?: DayTradeSoxsFailedBounce | null }) {
  if (!strategy) return null;
  const signal = strategy.signal;
  const paper = strategy.paper;
  const backtest = strategy.backtest;
  const open = paper?.openPosition;

  return (
    <section className="mb-8 rounded-2xl border border-zinc-700 bg-zinc-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Forward paper · SOXS</p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">{strategy.title || 'SOXS failed-bounce paper test'}</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Forward-only since {paper?.startedAt ? String(paper.startedAt).slice(0, 10) : 'not started'} · $
            {(paper?.notionalPerTrade ?? 0).toLocaleString()} paper notional per trade
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${soxsSignalClass(
            signal?.action,
          )}`}
        >
          {signal?.action || 'WAIT'}
        </span>
      </div>

      {signal ? (
        <div className={`mt-4 rounded-xl border p-4 ${soxsSignalClass(signal.action)}`} aria-live="polite">
          <h3 className="text-lg font-bold">{signal.headline}</h3>
          {signal.detail ? <p className="mt-1 text-sm opacity-90">{signal.detail}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-80">
            {signal.signalDate ? <span>Signal: {formatSignalDate(signal.signalDate)}</span> : null}
            {signal.entryPrice !== undefined ? <span>Entry: ${signal.entryPrice.toFixed(2)}</span> : null}
            {signal.exitPrice !== undefined ? <span>Exit: ${signal.exitPrice.toFixed(2)}</span> : null}
            {signal.returnPct !== undefined ? <span>Return: {pct(signal.returnPct, 2)}</span> : null}
            {signal.pnl !== undefined ? <span>Paper P&amp;L: ${signal.pnl.toFixed(2)}</span> : null}
          </div>
          {signal.exitPlan ? <p className="mt-2 text-sm font-semibold">{signal.exitPlan}</p> : null}
          {signal.paperStatus ? <p className="mt-1 text-xs opacity-70">{signal.paperStatus}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Forward trades</div>
          <div className="mt-1 font-mono text-xl text-zinc-100">{paper?.closedTrades ?? 0}</div>
          <div className="text-xs text-zinc-500">
            {paper?.winRatePct !== null && paper?.winRatePct !== undefined ? `${paper.winRatePct}% win` : 'Building sample'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Forward P&amp;L</div>
          <div className={`mt-1 font-mono text-xl ${(paper?.totalPnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            ${(paper?.totalPnl ?? 0).toFixed(2)}
          </div>
          <div className="text-xs text-zinc-500">
            {paper?.avgReturnPct !== null && paper?.avgReturnPct !== undefined
              ? `${pct(paper.avgReturnPct, 2)} avg`
              : 'Closed trades only'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Backtest edge</div>
          <div className="mt-1 font-mono text-xl text-emerald-300">{pct(backtest?.avgReturnPct, 2)}</div>
          <div className="text-xs text-zinc-500">
            n={backtest?.trades ?? 0} · {backtest?.winRatePct ?? '—'}% win · PF {backtest?.profitFactor ?? '—'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Open paper trade</div>
          <div className={`mt-1 font-mono text-xl ${(open?.openReturnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {open ? pct(open.openReturnPct, 2) : 'None'}
          </div>
          <div className="text-xs text-zinc-500">
            {open ? `SOXS from $${open.entryPrice?.toFixed(2) ?? '—'}` : 'Waiting for confirmed setup'}
          </div>
        </div>
      </div>

      {strategy.rules?.length ? (
        <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Exact rules</summary>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-zinc-400">
            {strategy.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          {backtest?.note ? <p className="mt-3 text-xs text-zinc-600">{backtest.note}</p> : null}
        </details>
      ) : null}

      {paper?.recentClosed?.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">Entry</th>
                <th className="pb-2 font-medium">Exit</th>
                <th className="pb-2 font-medium">Return</th>
                <th className="pb-2 font-medium">Paper P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {paper.recentClosed.map((trade) => (
                <tr key={`${trade.entryDate}-${trade.exitDate}`} className="border-t border-zinc-800 text-zinc-300">
                  <td className="py-2">{trade.entryDate}</td>
                  <td className="py-2">{trade.exitDate}</td>
                  <td className={`py-2 font-mono ${(trade.returnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {pct(trade.returnPct, 2)}
                  </td>
                  <td className="py-2 font-mono">${(trade.pnl ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function BounceFailArmorPanel({ strategy }: { strategy?: DayTradeBounceFailArmor | null }) {
  if (!strategy) return null;
  const signal = strategy.signal;
  const paper = strategy.paper;
  const backtest = strategy.backtest;
  const opens = paper?.openPositions?.length ? paper.openPositions : paper?.openPosition ? [paper.openPosition] : [];
  const watchRows = (strategy.tickerSignals || []).filter((row) => row.action && row.action !== 'WAIT');

  return (
    <section className="mb-8 rounded-2xl border border-amber-900/50 bg-zinc-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-600/80">
            Forward paper · bounce armor
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">
            {strategy.title || 'Bounce-fail armor'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Main bounce rules unchanged. Armor buys the failure day so you do not lose steam after a scare.
            Forward-only since {paper?.startedAt ? String(paper.startedAt).slice(0, 10) : 'not started'} · $
            {(paper?.notionalPerTrade ?? 0).toLocaleString()} paper notional
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${soxsSignalClass(
            signal?.action,
          )}`}
        >
          {signal?.action || 'WAIT'}
          {signal?.ticker ? ` · ${signal.ticker}` : ''}
        </span>
      </div>

      {signal ? (
        <div className={`mt-4 rounded-xl border p-4 ${soxsSignalClass(signal.action)}`} aria-live="polite">
          <h3 className="text-lg font-bold">{signal.headline}</h3>
          {signal.detail ? <p className="mt-1 text-sm opacity-90">{signal.detail}</p> : null}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs opacity-80">
            {signal.ticker ? <span>Ticker: {signal.ticker}</span> : null}
            {signal.signalDate ? <span>Signal: {formatSignalDate(signal.signalDate)}</span> : null}
            {signal.entryPrice !== undefined ? <span>Entry: ${signal.entryPrice.toFixed(2)}</span> : null}
            {signal.exitPrice !== undefined ? <span>Exit: ${signal.exitPrice.toFixed(2)}</span> : null}
            {signal.returnPct !== undefined ? <span>Return: {pct(signal.returnPct, 2)}</span> : null}
            {signal.pnl !== undefined ? <span>Paper P&amp;L: ${signal.pnl.toFixed(2)}</span> : null}
          </div>
          {signal.exitPlan ? <p className="mt-2 text-sm font-semibold">{signal.exitPlan}</p> : null}
          {signal.paperStatus ? <p className="mt-1 text-xs opacity-70">{signal.paperStatus}</p> : null}
        </div>
      ) : null}

      {watchRows.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {watchRows.map((row) => (
            <span
              key={`${row.ticker}-${row.action}-${row.signalDate}`}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${soxsSignalClass(
                row.action,
              )}`}
            >
              {row.ticker} · {row.action}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Forward trades</div>
          <div className="mt-1 font-mono text-xl text-zinc-100">{paper?.closedTrades ?? 0}</div>
          <div className="text-xs text-zinc-500">
            {paper?.winRatePct !== null && paper?.winRatePct !== undefined ? `${paper.winRatePct}% win` : 'Building sample'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Forward P&amp;L</div>
          <div className={`mt-1 font-mono text-xl ${(paper?.totalPnl ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            ${(paper?.totalPnl ?? 0).toFixed(2)}
          </div>
          <div className="text-xs text-zinc-500">
            {paper?.avgReturnPct !== null && paper?.avgReturnPct !== undefined
              ? `${pct(paper.avgReturnPct, 2)} avg`
              : 'Closed trades only'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Backtest edge</div>
          <div className="mt-1 font-mono text-xl text-emerald-300">{pct(backtest?.avgReturnPct, 2)}</div>
          <div className="text-xs text-zinc-500">
            n={backtest?.trades ?? 0} · {backtest?.winRatePct ?? '—'}% win · PF {backtest?.profitFactor ?? '—'}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Open armor</div>
          <div className={`mt-1 font-mono text-xl ${(opens[0]?.openReturnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {opens[0] ? pct(opens[0].openReturnPct, 2) : 'None'}
          </div>
          <div className="text-xs text-zinc-500">
            {opens[0]
              ? `${opens[0].ticker || '—'} from $${opens[0].entryPrice?.toFixed(2) ?? '—'}`
              : 'Waiting for a bounce to fail'}
          </div>
        </div>
      </div>

      {strategy.rules?.length ? (
        <details className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-300">Exact armor rules</summary>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-zinc-400">
            {strategy.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
          {backtest?.note ? <p className="mt-3 text-xs text-zinc-600">{backtest.note}</p> : null}
        </details>
      ) : null}

      {paper?.recentClosed?.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-zinc-500">
              <tr>
                <th className="pb-2 font-medium">Ticker</th>
                <th className="pb-2 font-medium">Entry</th>
                <th className="pb-2 font-medium">Exit</th>
                <th className="pb-2 font-medium">Return</th>
                <th className="pb-2 font-medium">Paper P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {paper.recentClosed.map((trade) => (
                <tr
                  key={`${trade.ticker}-${trade.entryDate}-${trade.exitDate}`}
                  className="border-t border-zinc-800 text-zinc-300"
                >
                  <td className="py-2 font-semibold">{trade.ticker}</td>
                  <td className="py-2">{trade.entryDate}</td>
                  <td className="py-2">{trade.exitDate}</td>
                  <td className={`py-2 font-mono ${(trade.returnPct ?? 0) >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {pct(trade.returnPct, 2)}
                  </td>
                  <td className="py-2 font-mono">${(trade.pnl ?? 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function PracticalCutoffsChart({ rows }: { rows?: DayTradeCutoffRow[] }) {
  if (!rows?.length) return null;
  return (
    <section className="mb-8 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900/60">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-100">Practical cutoffs</h2>
        <p className="mt-1 text-sm text-zinc-400">
          SOXL backtest cheat sheet — match today&apos;s down day to a zone, then follow the card signal.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Day down</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Signal</th>
              <th className="px-4 py-3 font-medium">Entry</th>
              <th className="px-4 py-3 font-medium">Backtest</th>
              <th className="px-4 py-3 font-medium">Plan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.zone} className="border-b border-zinc-800/80 last:border-0">
                <td className="px-4 py-3 font-semibold text-zinc-200">{row.zone}</td>
                <td className="px-4 py-3 font-mono text-zinc-300">{row.dayDown}</td>
                <td className="px-4 py-3 text-zinc-400">{row.bounceScore}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${signalBadgeClass(
                      row.signal.startsWith('BUY') ? 'BUY' : row.signal === 'NO TRADE' ? 'NO_TRADE' : 'WAIT',
                    )}`}
                  >
                    {row.signal}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{row.entry}</td>
                <td className="px-4 py-3 text-xs text-zinc-500">{row.backtest}</td>
                <td className="px-4 py-3 text-zinc-400">{row.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoricalStatsPanel({ stats }: { stats?: DayTradeHistoricalStats }) {
  if (!stats?.pairs?.length) return null;
  return (
    <section className="mb-8 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-5">
      <h2 className="text-lg font-semibold text-emerald-200">What BOUNCE days usually do</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Backtest since {stats.start || '2015'} on <span className="text-zinc-200">bounce &gt;= {stats.bounceCutoff ?? 65}</span>{' '}
        signals. Entry at <span className="text-emerald-300">crash-day close</span> (your playbook) — same-day{' '}
        <span className="text-emerald-300">high</span> is the rip; <span className="text-zinc-300">close</span> often
        fades.
      </p>
      <div className="mt-4 space-y-6">
        {stats.pairs.map((pair) => {
          const block = pair.crashClose?.count ? pair.crashClose : pair.nextOpen;
          const entryLabel = block?.entry === 'close_signal' ? 'crash-day close' : 'next open';
          return (
            <div key={pair.bull}>
              <h3 className="font-semibold text-zinc-200">
                {pair.bull} · {pair.signalCount ?? 0} BOUNCE signals
              </h3>
              {block?.count ? (
                <p className="mt-1 text-xs text-zinc-500">Buy at {entryLabel} — {block.count} historical signals</p>
              ) : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <HistMetric label="Same-day HIGH (the rip)" m={block?.sameDayHigh} />
                <HistMetric label="Same-day close (often fades)" m={block?.sameDayClose} />
                <HistMetric label="Same-day LOW (flush risk)" m={block?.sameDayLow} />
                <HistMetric label="+4 day close (hold piece)" m={block?.hold4DayClose} />
              </div>
            </div>
          );
        })}
      </div>
      {stats.note ? <p className="mt-4 text-xs text-zinc-500">{stats.note}</p> : null}
    </section>
  );
}

function BounceTierGuidePanel({
  guide,
  backtest,
}: {
  guide?: DayTradeBounceTierGuide;
  backtest?: DayTradeBounceTierBacktest;
}) {
  if (!guide?.title) return null;

  const soxl = backtest?.pairs?.find((p) => p.ticker === 'SOXL');
  const strong = soxl?.tiers?.STRONG_gapUpOpen;
  const standard = soxl?.tiers?.STANDARD_flatOrDownOpen;

  return (
    <section className="mb-8 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-5">
      <h2 className="text-lg font-semibold text-amber-200">{guide.title}</h2>
      {guide.summary ? <p className="mt-2 text-sm leading-relaxed text-zinc-300">{guide.summary}</p> : null}

      {guide.strongPattern?.length ? (
        <div className="mt-4 rounded-xl border border-amber-900/50 bg-black/20 px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-amber-300/90">What STRONG is</div>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-300">
            {guide.strongPattern.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {guide.closing ? <p className="mt-4 text-sm leading-relaxed text-zinc-400">{guide.closing}</p> : null}

      {guide.howToRead ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {guide.howToRead.overnightOpenPct ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">overnightOpenPct</dt>
              <dd className="mt-1 text-zinc-300">{guide.howToRead.overnightOpenPct}</dd>
            </div>
          ) : null}
          {guide.howToRead.STRONG ? (
            <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-emerald-400">STRONG</dt>
              <dd className="mt-1 text-zinc-300">{guide.howToRead.STRONG}</dd>
            </div>
          ) : null}
          {guide.howToRead.STANDARD ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">STANDARD</dt>
              <dd className="mt-1 text-zinc-300">{guide.howToRead.STANDARD}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {strong?.count && standard?.count ? (
        <p className="mt-4 text-xs text-zinc-500">
          SOXL backtest since {backtest?.start || '2015'}: STRONG n={strong.count}, avg next day{' '}
          {strong.avgFwdPct !== undefined && strong.avgFwdPct >= 0 ? '+' : ''}
          {strong.avgFwdPct}% ({strong.winRatePct}% win) · STANDARD n={standard.count}, avg{' '}
          {standard.avgFwdPct !== undefined && standard.avgFwdPct >= 0 ? '+' : ''}
          {standard.avgFwdPct}% ({standard.winRatePct}% win) — same crash-close entry for both.
        </p>
      ) : null}
    </section>
  );
}

function TickerCard({ row, highlight }: { row: DayTradeTicker; highlight?: boolean }) {
  const sig = row.tradeSignal;
  const zone = row.dayDownZone;
  return (
    <div
      className={`rounded-2xl border p-4 ${highlight ? 'border-emerald-600/80 bg-emerald-950/20' : 'border-zinc-800 bg-zinc-900/60'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-zinc-100">{row.ticker}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${setupBadge(row.setup)}`}>
              {row.setup}
            </span>
            {sig ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${signalBadgeClass(sig.action)}`}>
                {sig.action === 'NO_TRADE' ? 'NO TRADE' : sig.action}
              </span>
            ) : null}
            {row.bounceTier === 'STRONG' ? (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-950">
                STRONG
              </span>
            ) : null}
            {row.bounceTier === 'STANDARD' && row.setup === 'BOUNCE' ? (
              <span className="rounded-full bg-zinc-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-100">
                STANDARD
              </span>
            ) : null}
          </div>
          <p className="text-xs text-zinc-500">{row.label}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg text-zinc-100">${row.price.toFixed(2)}</div>
          <div className={`font-mono text-sm ${row.change1dPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {pct(row.change1dPct)} 1d
          </div>
        </div>
      </div>

      <div className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClass(row.tone)}`}>
        {row.action}
      </div>

      {sig ? (
        <div className={`mt-3 rounded-xl border px-3 py-2 ${signalClass(sig.action)}`}>
          <div className="text-sm font-bold">{sig.headline}</div>
          {sig.sub && sig.sub !== sig.whyNotBuy ? (
            <div className="mt-1 text-xs opacity-90">{sig.sub}</div>
          ) : null}
          {sig.whyNotBuy && (sig.action === 'NO_TRADE' || sig.action === 'WAIT') ? (
            <div className="mt-2 rounded-lg border border-amber-700/50 bg-amber-950/30 px-2.5 py-2 text-xs leading-relaxed text-amber-100">
              <span className="font-semibold text-amber-300">Why not BUY yet: </span>
              {sig.whyNotBuy}
            </div>
          ) : null}
          {zone?.label ? (
            <div className="mt-2 text-[11px] opacity-80">
              Down-day zone: <span className="font-semibold">{zone.label}</span>
              {zone.sizeHint ? ` · ${zone.sizeHint}` : ''}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{row.detail}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div>
          <div className="text-zinc-500">5d</div>
          <div className={`font-mono ${row.change5dPct >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}>
            {pct(row.change5dPct)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">RSI</div>
          <div className="font-mono text-zinc-200">{row.rsi14 ?? '—'}</div>
        </div>
        <div>
          <div className="text-zinc-500">vs 5d SMA</div>
          <div className="font-mono text-zinc-200">{pct(row.distSma5Pct)}</div>
        </div>
        <div>
          <div className="text-zinc-500">1d z</div>
          <div className="font-mono text-zinc-200">{row.zScore1d.toFixed(2)}</div>
        </div>
        {row.overnightOpenPct !== null && row.overnightOpenPct !== undefined ? (
          <div>
            <div className="text-zinc-500">Open vs prior</div>
            <div className={`font-mono ${row.overnightOpenPct >= 0 ? 'text-amber-300' : 'text-zinc-200'}`}>
              {pct(row.overnightOpenPct)}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>Bounce stretch</span>
          <span className="font-mono text-zinc-300">{row.bounceScore}</span>
        </div>
        {scoreBar(row.bounceScore, 'bg-emerald-500')}
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>Fade / extended</span>
          <span className="font-mono text-zinc-300">{row.fadeScore}</span>
        </div>
        {scoreBar(row.fadeScore, 'bg-orange-500')}
      </div>

      {row.underlying && row.underlyingChange1dPct !== null && row.underlyingChange1dPct !== undefined ? (
        <p className="mt-3 text-xs text-zinc-500">
          Underlying {row.underlying}: {pct(row.underlyingChange1dPct)} 1d
        </p>
      ) : null}
    </div>
  );
}

function PairPanel({ pair }: { pair: DayTradePair }) {
  const bull = pair.bull;
  const bear = pair.bear;
  if (!bull && !bear) return null;

  const best =
    bull?.tradeSignal?.action === 'EXIT' || bull?.tradeSignal?.action === 'BUY'
      ? bull
      : bear?.tradeSignal?.action === 'EXIT' || bear?.tradeSignal?.action === 'BUY'
        ? bear
        : (bull?.bounceScore ?? 0) >= (bear?.bounceScore ?? 0)
          ? bull
          : bear;

  const title = pair.underlying
    ? bear
      ? `${pair.underlying} pair`
      : `${pair.underlying} · bull only`
    : bear
      ? 'Pair'
      : 'Bull only';

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          {!bear && bull?.ticker === 'KORU' ? (
            <p className="mt-1 text-xs text-zinc-500">
              No liquid Korea 3× inverse (KORZ liquidated) — bounce signals only.
            </p>
          ) : null}
        </div>
        {best && best.setup !== 'NEUTRAL' ? (
          <span className="text-sm text-zinc-400">
            Best setup: <span className="font-semibold text-emerald-300">{best.ticker}</span> ({best.setup})
          </span>
        ) : (
          <span className="text-sm text-zinc-500">
            {bear ? 'No strong stretch on either leg' : 'No strong stretch'}
          </span>
        )}
      </div>
      <div className={`grid gap-4 ${bear ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-xl'}`}>
        {bull ? (
          <TickerCard
            row={bull}
            highlight={
              bull.tradeSignal?.action === 'BUY' ||
              bull.tradeSignal?.action === 'EXIT' ||
              (best?.ticker === bull.ticker && bull.setup === 'BOUNCE')
            }
          />
        ) : null}
        {bear ? (
          <TickerCard
            row={bear}
            highlight={
              bear.tradeSignal?.action === 'BUY' ||
              bear.tradeSignal?.action === 'EXIT' ||
              (best?.ticker === bear.ticker && bear.setup === 'BOUNCE')
            }
          />
        ) : null}
      </div>
    </section>
  );
}

export default function DayTradeClient() {
  const [payload, setPayload] = useState<DayTradePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scanner/daytrade', fetchInit)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || body?.message || 'Could not load day-trade data.');
        if (!cancelled) {
          setPayload(body.data ?? body);
          setError('');
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load day-trade data.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const topBounce = useMemo(() => payload?.topBounce ?? [], [payload]);
  const pairs = useMemo(() => payload?.pairs ?? [], [payload]);
  const learned = payload?.learnedPain;

  return (
    <div>
      <ScannerExtrasNav active="/scanner/daytrade" />

      {loading ? <p className="text-zinc-400">Loading stretch scores…</p> : null}
      {error ? <p className="rounded-xl border border-red-800 bg-red-950/40 p-4 text-red-200">{error}</p> : null}

      {payload?.generatedAt ? (
        <p className="mb-6 text-sm text-zinc-500">
          Data as of {String(payload.generatedAt).replace('T', ' ')}
          {payload.tickerCount ? ` · ${payload.tickerCount} instruments` : ''}
        </p>
      ) : null}

      <PrimarySignalBanner signal={payload?.primarySignal} />
      <BounceFailArmorPanel strategy={payload?.bounceFailArmor} />
      <SoxsFailedBouncePanel strategy={payload?.soxsFailedBounce} />
      <PracticalCutoffsChart rows={payload?.practicalCutoffs} />
      <BounceTierGuidePanel guide={payload?.bounceTierGuide} backtest={payload?.bounceTierBacktest} />

      {learned ? (
        <section className="mb-8 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5">
          <h2 className="text-lg font-semibold text-zinc-100">Learned pain (core book only)</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            <span className="font-semibold text-amber-300">{learned.badge || 'Learned pain'}</span>
            {' · '}
            {learned.action || '—'}
            {learned.reason ? ` · ${learned.reason}` : ''}
          </p>
          <p className="mt-3 text-sm text-zinc-300">
            Yes — read it as: about a{' '}
            <span className="font-semibold text-zinc-100">{learned.painProb20dPct || '81%'}</span> chance the{' '}
            <span className="italic">core quality portfolio</span> loses{' '}
            <span className="font-semibold">≥8%</span> within the next <span className="font-semibold">20 trading days</span>,
            and about <span className="font-semibold text-zinc-100">{learned.painProb60dPct || '98%'}</span> chance it
            loses <span className="font-semibold">≥15%</span> within <span className="font-semibold">60 days</span>.
            That is <span className="italic">not</span> “QQQ down 8% tomorrow” and not SOXL-specific — it scales your{' '}
            <span className="italic">stock scanner book</span> to 0% / 50% / 100%.
          </p>
          {learned.note ? <p className="mt-2 text-xs text-zinc-500">{learned.note}</p> : null}
        </section>
      ) : null}

      <HistoricalStatsPanel stats={payload?.historicalStats} />

      {topBounce.length ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-zinc-100">Top bounce / watch</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Highest stretch scores right now — your SOXL-style mean-reversion candidates for the next session.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topBounce.map((row) => (
              <TickerCard key={row.ticker} row={row} highlight={row.setup === 'BOUNCE'} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8 space-y-5">
        <h2 className="text-xl font-semibold text-zinc-100">Bull / bear pairs</h2>
        {pairs.map((pair) => (
          <PairPanel key={`${pair.bull?.ticker}-${pair.bear?.ticker}`} pair={pair} />
        ))}
      </section>

      {payload?.playbook?.length || payload?.method?.length ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 text-sm text-zinc-400">
          <h3 className="mb-2 font-semibold text-zinc-300">Playbook</h3>
          <ul className="list-inside list-disc space-y-1">
            {(payload.playbook ?? payload.method ?? []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">
            Rip then fade: take partials into the morning/ midday pop (+5–10% on SOXL is common on BOUNCE days).
            Closing the whole position at 4pm often gives back the bounce. A smaller piece can ride 2–4 days when the
            trend reclaims — see historical stats above.
          </p>
        </section>
      ) : null}
    </div>
  );
}
