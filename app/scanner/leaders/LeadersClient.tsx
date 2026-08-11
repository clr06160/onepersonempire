'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  LeadersMember,
  LeadersMicrosector,
  LeadersPayload,
  LeadersRule,
  TrendScout,
} from '@/lib/scanner-leaders-data';
import { statusLabel } from '@/lib/scanner-wave4-rules';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function pct(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function signClass(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'text-zinc-500';
  if (value > 0) return 'text-emerald-400/90';
  if (value < 0) return 'text-red-400/90';
  return 'text-zinc-300';
}

function stageClass(stage?: string) {
  if (stage === 'Leading') return 'text-emerald-300';
  if (stage === 'Emerging') return 'text-sky-300';
  if (stage === 'Extended') return 'text-amber-300';
  if (stage === 'Lagging') return 'text-red-300/90';
  return 'text-zinc-400';
}

function ruleBorder(tone?: string) {
  if (tone === 'danger') return 'border-red-800/70 bg-red-950/35';
  if (tone === 'warning') return 'border-amber-800/70 bg-amber-950/30';
  return 'border-sky-800/60 bg-sky-950/25';
}

function wave4ChipClass(status?: string | null) {
  if (status === 'about_done' || status === 'confirmed_wave4') {
    return 'border-amber-700/70 bg-amber-950/60 text-amber-200';
  }
  if (status === 'extended') return 'border-orange-800/60 bg-orange-950/40 text-orange-200';
  if (status === 'riding') return 'border-emerald-800/50 bg-emerald-950/40 text-emerald-300';
  if (status === 'cooling') return 'border-zinc-600 bg-zinc-900 text-zinc-400';
  return 'border-zinc-700 bg-zinc-900 text-zinc-500';
}

/** Compact strip — are leaders about done (wave 4)? */
function Wave4MiniStrip({
  summary,
}: {
  summary?: LeadersPayload['wave4Summary'];
}) {
  if (!summary) return null;
  const done = (summary.aboutDone || 0) + (summary.confirmedWave4 || 0);
  const watched =
    (summary.riding || 0) +
    (summary.extended || 0) +
    done +
    (summary.cooling || 0);
  if (!watched) return null;

  const names = (summary.namesAboutDone || []).slice(0, 8);

  return (
    <section className="mb-4 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-400/90">
            Wave 4 · leaders about done?
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            <span className="font-mono font-semibold text-amber-200">{done}</span>
            <span className="text-zinc-500"> / {watched}</span>
            {' '}extended names broke 10/21/50 — bank / rotate
            {summary.extended ? (
              <>
                {' · '}
                <span className="font-mono text-orange-300">{summary.extended}</span> still extended
                (tighten trail)
              </>
            ) : null}
          </p>
        </div>
        <a
          href="/scanner/tops-bottoms"
          className="shrink-0 text-xs font-medium text-amber-300/90 hover:text-amber-200"
        >
          Rules →
        </a>
      </div>
      {names.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {names.map((row) => (
            <a
              key={row.ticker}
              href={`/scanner/charts?ticker=${encodeURIComponent(row.ticker)}`}
              title={row.note}
              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${wave4ChipClass(row.status)}`}
            >
              {row.ticker}
              <span className="text-[9px] uppercase opacity-80">
                {row.status === 'confirmed_wave4' ? 'W4' : 'done'}
              </span>
            </a>
          ))}
          {(summary.namesAboutDone || []).length > names.length ? (
            <span className="self-center text-[11px] text-zinc-500">
              +{(summary.namesAboutDone || []).length - names.length} more
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-zinc-500">
          No leaders at wave-4 exit right now — rides still open.
        </p>
      )}
    </section>
  );
}

function HowToRead() {
  return (
    <section className="mb-6 rounded-2xl border border-emerald-800/50 bg-emerald-950/20 p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400">
        How to read this board
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-50">RS = beat QQQ by X percentage points</h2>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
        <li>
          <span className="font-semibold text-zinc-100">RS 63d</span> is the sort key. A microsector
          at <span className="font-mono text-emerald-300">+39%</span> means its median name&apos;s
          ~63-trading-day return beat QQQ by about 39 percentage points over that same window — not
          that the group only rose 39%.
        </li>
        <li>
          Basket RS uses the <span className="font-semibold text-zinc-100">median</span> member
          return minus QQQ. Click a row; names inside are also ranked by RS63. Sales / EPS are for
          judgment, not the rank.
        </li>
        <li>
          <span className="font-semibold text-zinc-100">RS 21d / 126d</span> are context (near-term
          acceleration vs longer trend).{' '}
          <span className="font-semibold text-zinc-100">Stage</span> (Leading / Emerging / …) blends
          RS63 with how extended the basket is — helpful label, not the sort.
        </li>
        <li>
          AI themes stay pinned on top (still ordered by RS63 among themselves). Everything else
          follows by RS63. Trend Scout is for unmapped leadership — candidates, not auto-buys.
        </li>
        <li>
          <span className="font-semibold text-zinc-100">Earn 3d</span> is the settled post-print move
          (day+3 vs prior close), not the gap alone. Blue ≥+10%, red ≤−10%. Favor blues when you want
          higher-probability holdovers. The pre-earnings table uses that last settled print before the
          next report.
        </li>
      </ul>
    </section>
  );
}

function EarningsReactionNote({
  note,
  thresholdPct = 10,
}: {
  note?: LeadersPayload['earningsReactionNote'];
  thresholdPct?: number;
}) {
  if (!note?.blurb && !note?.passPlus) return null;
  const pass = note.passPlus;
  const fail = note.failMinus;
  return (
    <section className="mb-6 rounded-2xl border border-sky-800/50 bg-sky-950/20 p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-400">
        Earnings reaction edge
      </p>
      <h2 className="mt-2 text-lg font-semibold text-zinc-50">
        Day+3 ≥ +{thresholdPct}% keeps better odds — day-of is mostly noise
      </h2>
      {note.blurb ? (
        <p className="mt-3 text-sm leading-6 text-zinc-300">{note.blurb}</p>
      ) : null}
      {pass && fail ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-800/60 bg-sky-950/40 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-300">
              Day+3 ≥ +{thresholdPct}%
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-sky-200">
              +{pass.medianFwdToNextPrintPct}%
              <span className="ml-2 text-sm font-normal text-zinc-400">med to next print</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {pass.redByNextPrintPct}% red by next · {pass.madeNewHighBeforeNextPct}% still make a
              new high · n={pass.n}
            </p>
          </div>
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
              Day+3 ≤ −{thresholdPct}%
            </p>
            <p className="mt-2 font-mono text-2xl font-semibold text-red-200">
              {fail.medianFwdToNextPrintPct}%
              <span className="ml-2 text-sm font-normal text-zinc-400">med to next print</span>
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              {fail.redByNextPrintPct}% red by next · {fail.madeNewHighBeforeNextPct}% still make a
              new high · n={fail.n}
            </p>
          </div>
        </div>
      ) : null}
      {note.universe ? (
        <p className="mt-3 text-xs text-zinc-500">Study: {note.universe}.</p>
      ) : null}
    </section>
  );
}

function reactionChipClass(badge?: string | null) {
  if (badge === 'pass') return 'border-sky-600/70 bg-sky-950/70 text-sky-200';
  if (badge === 'fail') return 'border-red-700/70 bg-red-950/60 text-red-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function reactionPctClass(value?: number | null, threshold = 10) {
  if (value == null || Number.isNaN(value)) return 'text-zinc-500';
  if (value >= threshold) return 'bg-sky-950/80 font-semibold text-sky-200';
  if (value <= -threshold) return 'bg-red-950/70 font-semibold text-red-200';
  return 'text-zinc-300';
}

function factTagClass(tag: string) {
  if (
    tag.includes('down') ||
    tag.includes('miss') ||
    tag.includes('lagging') ||
    tag === 'Opaque' ||
    tag === 'Miss guidance'
  ) {
    return 'border-red-800/60 bg-red-950/40 text-red-200';
  }
  if (tag.includes('up') || tag.includes('beat') || tag === 'Beat guidance') {
    return 'border-sky-800/60 bg-sky-950/40 text-sky-200';
  }
  return 'border-zinc-700 bg-zinc-900 text-zinc-400';
}

function PreEarningsWatchlist({
  rows,
  windowDays = 10,
  threshold = 10,
  asOf,
}: {
  rows?: LeadersPayload['preEarningsWatchlist'];
  windowDays?: number;
  threshold?: number;
  asOf?: string | null;
}) {
  const list = rows || [];
  return (
    <section className="mb-6 rounded-2xl border border-violet-800/40 bg-violet-950/15 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">
            Pre-earnings · next {windowDays} days
          </p>
          <h2 className="mt-2 text-lg font-semibold text-zinc-50">
            Leaders reporting soon — last print facts
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Decide before the print. Same day+3 badge and plain facts as Monthly Reports. After
            day+3 settles, trust the new badge.
          </p>
        </div>
        <p className="font-mono text-sm text-zinc-500">
          {list.length} name{list.length === 1 ? '' : 's'}
          {asOf ? (
            <>
              {' '}
              · as of <span className="text-zinc-300">{asOf}</span>
            </>
          ) : null}
        </p>
      </div>

      {!list.length ? (
        <p className="mt-4 text-sm text-zinc-500">
          No Leaders names on the calendar in this window.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 font-medium">Reports</th>
                <th className="px-3 py-2 font-medium">Ticker</th>
                <th className="px-3 py-2 font-medium">Parent</th>
                <th className="px-3 py-2 font-medium">Last print</th>
                <th className="px-3 py-2 font-medium">What happened</th>
                <th className="px-3 py-2 font-medium">Earn 3d</th>
                <th className="px-3 py-2 font-medium">Badge</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => (
                <tr
                  key={`${row.ticker}-${row.earningsDate}`}
                  className="border-t border-zinc-800/80 align-top"
                >
                  <td className="px-3 py-2">
                    <p className="font-mono text-zinc-200">{row.earningsDate}</p>
                    {row.timeLabel ? (
                      <p className="text-[11px] text-zinc-500">{row.timeLabel}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={`/scanner/charts?ticker=${encodeURIComponent(row.ticker)}`}
                      className="font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      {row.ticker}
                    </a>
                    {row.microsector ? (
                      <p className="mt-0.5 text-[11px] text-zinc-600">{row.microsector}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{row.parent || '—'}</td>
                  <td className="px-3 py-2 font-mono text-zinc-500">
                    {row.lastEarningsDate || '—'}
                  </td>
                  <td className="max-w-[18rem] px-3 py-2">
                    {(row.causeTags || []).length ? (
                      <div className="flex flex-wrap gap-1">
                        {row.causeTags!.map((tag) => (
                          <span
                            key={tag}
                            className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium ${factTagClass(tag)}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {row.plainLine ? (
                      <p className="mt-1 text-xs leading-5 text-zinc-300">{row.plainLine}</p>
                    ) : !(row.causeTags || []).length ? (
                      <span className="text-xs text-zinc-600">—</span>
                    ) : null}
                  </td>
                  <td
                    className={`px-3 py-2 font-mono ${reactionPctClass(row.threeDayReactionPct, threshold)}`}
                  >
                    {pct(row.threeDayReactionPct)}
                  </td>
                  <td className="px-3 py-2">
                    {row.earningsBadge === 'pass' || row.earningsBadge === 'fail' ? (
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reactionChipClass(row.earningsBadge)}`}
                      >
                        {row.earningsBadge === 'pass' ? 'PASS+' : 'FAIL−'}
                      </span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EarningsHistoryStrip({
  history,
  threshold = 10,
}: {
  history?: LeadersMember['earningsHistory'];
  threshold?: number;
}) {
  if (!history?.length) {
    return <span className="text-zinc-600">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {history.map((print) => (
        <span
          key={print.reportDate}
          title={`${print.reportDate} · day0 ${pct(print.day0Pct)} · day+3 ${pct(print.day3Pct)}`}
          className={`inline-flex rounded px-1.5 py-0.5 font-mono text-[11px] ${reactionPctClass(print.day3Pct, threshold)}`}
        >
          {pct(print.day3Pct, 0)}
        </span>
      ))}
    </div>
  );
}

function Rules({ rules }: { rules: LeadersRule[] }) {
  if (!rules.length) return null;
  return (
    <section className="mb-6 grid gap-3">
      {rules.map((rule) => (
        <div key={rule.title} className={`rounded-2xl border p-4 ${ruleBorder(rule.tone)}`}>
          <h3 className="text-sm font-semibold text-zinc-100">{rule.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{rule.body}</p>
        </div>
      ))}
    </section>
  );
}

function MicrosectorTable({
  rows,
  selectedKey,
  onSelect,
}: {
  rows: LeadersMicrosector[];
  selectedKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80">
      <div className="border-b border-zinc-800 px-5 py-4">
        <h2 className="text-lg font-semibold text-zinc-100">Microsector RS vs QQQ</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Ranked by <span className="text-zinc-300">RS 63d</span> (bold column). Click any row to
          open its names below.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Parent</th>
              <th className="px-4 py-3 font-medium">Microsector</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">RS 21d</th>
              <th className="px-4 py-3 font-medium">RS 63d</th>
              <th className="px-4 py-3 font-medium">RS 126d</th>
              <th className="px-4 py-3 font-medium">Breadth &gt;50</th>
              <th className="px-4 py-3 font-medium">Near high</th>
              <th className="px-4 py-3 font-medium">Top names</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const active = row.key === selectedKey;
              const isAi = row.parent === 'AI';
              const prev = rows[idx - 1];
              const showDivider = idx > 0 && prev?.parent === 'AI' && !isAi;
              return (
                <Fragment key={row.key}>
                  {showDivider ? (
                    <tr className="border-t border-cyan-900/50 bg-zinc-950/60">
                      <td
                        colSpan={10}
                        className="px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500"
                      >
                        Other microsectors (ranked by RS)
                      </td>
                    </tr>
                  ) : null}
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    onClick={() => onSelect(row.key)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(row.key);
                      }
                    }}
                    className={`cursor-pointer border-t border-zinc-800/80 transition outline-none ${
                      active
                        ? 'bg-cyan-950/55 ring-1 ring-inset ring-cyan-500/50'
                        : isAi
                          ? 'bg-zinc-900/40 hover:bg-zinc-800/50'
                          : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-zinc-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                          isAi
                            ? 'bg-cyan-950 text-cyan-300'
                            : row.parent === 'Tech'
                              ? 'bg-violet-950 text-violet-300'
                              : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {row.parent || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`font-semibold underline-offset-2 ${active ? 'text-cyan-200' : 'text-zinc-100 hover:underline'}`}>
                        {row.label}
                        {active ? (
                          <span className="ml-2 text-xs font-normal text-cyan-400">open ↓</span>
                        ) : (
                          <span className="ml-2 text-xs font-normal text-zinc-600">click</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {row.buildoutLayer || row.key} · {row.tickerCount ?? 0} names
                      </div>
                    </td>
                    <td className={`px-4 py-3 font-medium ${stageClass(row.stage)}`}>{row.stage || '—'}</td>
                    <td className={`px-4 py-3 font-mono ${signClass(row.rs21)}`}>{pct(row.rs21)}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${signClass(row.rs63)}`}>
                      {pct(row.rs63)}
                    </td>
                    <td className={`px-4 py-3 font-mono ${signClass(row.rs126)}`}>{pct(row.rs126)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {row.breadthAbove50Pct != null ? `${row.breadthAbove50Pct}%` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {row.breadthNearHighPct != null ? `${row.breadthNearHighPct}%` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {(row.leaders || []).join(' · ') || '—'}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MembersTable({
  members,
  threshold = 10,
}: {
  members: LeadersMember[];
  threshold?: number;
}) {
  if (!members.length) {
    return (
      <p className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 text-sm text-zinc-400">
        No priced members for this microsector.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-cyan-900/40 bg-zinc-900/80">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-950/80 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Ticker</th>
            <th className="px-4 py-3 font-medium">Earn 3d</th>
            <th className="px-4 py-3 font-medium">~1y prints</th>
            <th className="px-4 py-3 font-medium">RS 21d</th>
            <th className="px-4 py-3 font-medium">RS 63d</th>
            <th className="px-4 py-3 font-medium">RS 126d</th>
            <th className="px-4 py-3 font-medium">Dist high</th>
            <th className="px-4 py-3 font-medium">Sales gr</th>
            <th className="px-4 py-3 font-medium">EPS gr</th>
            <th className="px-4 py-3 font-medium">Wave 4</th>
            <th className="px-4 py-3 font-medium">Above 50</th>
            <th className="px-4 py-3 font-medium">Last</th>
          </tr>
        </thead>
        <tbody>
          {members.map((row, idx) => (
            <tr key={row.ticker} className="border-t border-zinc-800/80">
              <td className="px-4 py-3 font-mono text-zinc-500">{idx + 1}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={`/scanner/charts?ticker=${encodeURIComponent(row.ticker)}`}
                    className="font-semibold text-cyan-300 hover:text-cyan-200"
                  >
                    {row.ticker}
                  </a>
                  {row.earningsBadge === 'pass' || row.earningsBadge === 'fail' ? (
                    <span
                      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reactionChipClass(row.earningsBadge)}`}
                      title={
                        row.lastEarningsDate
                          ? `Last print ${row.lastEarningsDate} · day+3 ${pct(row.threeDayReactionPct)}`
                          : `Day+3 ${pct(row.threeDayReactionPct)}`
                      }
                    >
                      {row.earningsBadge === 'pass' ? 'PASS+' : 'FAIL−'}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className={`px-4 py-3 font-mono ${reactionPctClass(row.threeDayReactionPct, threshold)}`}>
                {pct(row.threeDayReactionPct)}
              </td>
              <td className="px-4 py-3">
                <EarningsHistoryStrip history={row.earningsHistory} threshold={threshold} />
              </td>
              <td className={`px-4 py-3 font-mono ${signClass(row.rs21)}`}>{pct(row.rs21)}</td>
              <td className={`px-4 py-3 font-mono font-semibold ${signClass(row.rs63)}`}>
                {pct(row.rs63)}
              </td>
              <td className={`px-4 py-3 font-mono ${signClass(row.rs126)}`}>{pct(row.rs126)}</td>
              <td className={`px-4 py-3 font-mono ${signClass(row.distToHighPct)}`}>
                {pct(row.distToHighPct)}
              </td>
              <td className={`px-4 py-3 font-mono ${signClass(row.salesGrowthPct)}`}>
                {pct(row.salesGrowthPct)}
              </td>
              <td className={`px-4 py-3 font-mono ${signClass(row.epsGrowthPct)}`}>
                {pct(row.epsGrowthPct)}
              </td>
              <td className="px-4 py-3">
                {row.wave4?.status && row.wave4.status !== 'unknown' ? (
                  <span
                    title={row.wave4.note}
                    className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${wave4ChipClass(row.wave4.status)}`}
                  >
                    {statusLabel(row.wave4.status)}
                    {row.wave4.runPct != null ? (
                      <span className="ml-1 font-mono font-normal opacity-80">
                        +{Math.round(row.wave4.runPct)}%
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {row.above50dma == null ? '—' : row.above50dma ? 'Yes' : 'No'}
              </td>
              <td className="px-4 py-3 font-mono text-zinc-300">
                {row.lastClose != null ? row.lastClose.toFixed(2) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrendScoutPanel({ scout }: { scout?: TrendScout }) {
  if (!scout) return null;
  const orphans = scout.orphans || [];
  const clusters = scout.clusters || [];
  const phrases = scout.risingPhrases || [];
  if (!orphans.length && !clusters.length && !phrases.length) {
    return (
      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-lg font-semibold text-zinc-100">Trend Scout</h2>
        <p className="mt-2 text-sm text-zinc-500">
          No orphan leaders or rising phrases this run. Rebuild after news refresh for phrase heat.
        </p>
      </section>
    );
  }
  return (
    <section className="mt-10 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Trend Scout</h2>
        <p className="mt-1 text-sm text-zinc-500">
          New-theme radar: strong RS names outside mapped baskets, industry clusters, and rising
          headline phrases.
        </p>
      </div>

      {clusters.length ? (
        <div className="overflow-x-auto rounded-2xl border border-violet-900/40 bg-zinc-900/80">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-violet-200">
            Orphan industry clusters
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Industry</th>
                <th className="px-4 py-2">Names</th>
                <th className="px-4 py-2">Med RS63</th>
                <th className="px-4 py-2">Tickers</th>
              </tr>
            </thead>
            <tbody>
              {clusters.map((c) => (
                <tr key={c.industry} className="border-t border-zinc-800/80">
                  <td className="px-4 py-3 text-zinc-100">{c.industry}</td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{c.tickerCount}</td>
                  <td className={`px-4 py-3 font-mono ${signClass(c.medianRs63)}`}>
                    {pct(c.medianRs63)}
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-400">
                    {(c.tickers || []).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {orphans.length ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/80">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">
            Orphan RS leaders
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Ticker</th>
                <th className="px-4 py-2">Earn 3d</th>
                <th className="px-4 py-2">RS63</th>
                <th className="px-4 py-2">Industry</th>
                <th className="px-4 py-2">Sales</th>
                <th className="px-4 py-2">EPS</th>
              </tr>
            </thead>
            <tbody>
              {orphans.slice(0, 15).map((o) => (
                <tr key={o.ticker} className="border-t border-zinc-800/80">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/scanner/charts?ticker=${encodeURIComponent(o.ticker)}`}
                        className="font-semibold text-cyan-300 hover:text-cyan-200"
                      >
                        {o.ticker}
                      </a>
                      {o.earningsBadge === 'pass' || o.earningsBadge === 'fail' ? (
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${reactionChipClass(o.earningsBadge)}`}
                        >
                          {o.earningsBadge === 'pass' ? 'PASS+' : 'FAIL−'}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={`px-4 py-3 font-mono ${reactionPctClass(o.threeDayReactionPct)}`}>
                    {pct(o.threeDayReactionPct)}
                  </td>
                  <td className={`px-4 py-3 font-mono ${signClass(o.rs63)}`}>{pct(o.rs63)}</td>
                  <td className="px-4 py-3 text-zinc-400">{o.industry || '—'}</td>
                  <td className={`px-4 py-3 font-mono ${signClass(o.salesGrowthPct)}`}>
                    {pct(o.salesGrowthPct)}
                  </td>
                  <td className={`px-4 py-3 font-mono ${signClass(o.epsGrowthPct)}`}>
                    {pct(o.epsGrowthPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {phrases.length ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/80">
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">
            Rising headline phrases
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2">Phrase</th>
                <th className="px-4 py-2">Tickers</th>
                <th className="px-4 py-2">Example</th>
              </tr>
            </thead>
            <tbody>
              {phrases.map((p) => (
                <tr key={p.phrase} className="border-t border-zinc-800/80">
                  <td className="px-4 py-3 font-medium text-zinc-100">{p.phrase}</td>
                  <td className="px-4 py-3 font-mono text-zinc-400">
                    {(p.tickers || []).join(' · ') || p.tickerCount}
                  </td>
                  <td className="max-w-md truncate px-4 py-3 text-zinc-500">{p.example || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

export default function LeadersClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<LeadersPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState('');
  const membersRef = useRef<HTMLElement | null>(null);
  const skipScrollOnLoad = useRef(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/leaders', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load Leaders.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    const next = (payload.data || null) as LeadersPayload | null;
    setData(next);
    const initial = next?.defaultMicrosectorKey || next?.microsectors?.[0]?.key || '';
    setSelectedKey((prev) => prev || initial);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectMicrosector = useCallback((key: string) => {
    skipScrollOnLoad.current = false;
    setSelectedKey(key);
  }, []);

  useEffect(() => {
    if (!selectedKey || skipScrollOnLoad.current) return;
    const node = membersRef.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [selectedKey]);

  const microsectors = data?.microsectors || [];

  const members = useMemo(() => {
    if (!selectedKey) return [] as LeadersMember[];
    return data?.membersByKey?.[selectedKey] || [];
  }, [data, selectedKey]);

  const selected = microsectors.find((row) => row.key === selectedKey);
  const selectedLabel = selected?.label || selectedKey || '—';
  const xlk63 = data?.benchmark?.xlkRsVsQqq?.rs63;

  return (
    <>
      <ScannerExtrasNav active="/scanner/leaders" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading Leaders…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <>
          {error ? (
            <p className="mb-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p>
          ) : null}

          {data?.message && !(data?.microsectors || []).length ? (
            <p className="mb-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">
              {data.message}
            </p>
          ) : null}

          <HowToRead />

          <Wave4MiniStrip summary={data?.wave4Summary} />

          <EarningsReactionNote
            note={data?.earningsReactionNote}
            thresholdPct={data?.earningsReactionThresholdPct ?? 10}
          />

          <PreEarningsWatchlist
            rows={data?.preEarningsWatchlist}
            windowDays={data?.preEarningsWindowDays ?? 10}
            threshold={data?.earningsReactionThresholdPct ?? 10}
            asOf={data?.preEarningsAsOf}
          />

          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 text-sm text-zinc-400">
            <p>
              As of <span className="font-mono text-zinc-200">{data?.asOf || '—'}</span>
              {data?.generatedAt ? (
                <>
                  {' '}
                  · built <span className="font-mono text-zinc-300">{data.generatedAt.slice(0, 19)}Z</span>
                </>
              ) : null}
              {' · '}
              {microsectors.length} microsectors
            </p>
            <p>
              XLK RS 63d vs QQQ:{' '}
              <span className={`font-mono font-semibold ${signClass(xlk63)}`}>{pct(xlk63)}</span>
            </p>
          </div>

          <Rules rules={data?.operatingRules || []} />

          <section
            ref={membersRef}
            id="leaders-members"
            className="mb-6 scroll-mt-6 rounded-2xl border border-cyan-800/50 bg-cyan-950/20 p-5"
          >
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-400">
                {selectedKey && selectedKey === (microsectors[0]?.key || '')
                  ? 'Open · #1 theme'
                  : 'Open microsector'}
              </p>
              <h2 className="mt-1 text-2xl font-bold text-zinc-50">{selectedLabel}</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {selected?.parent || '—'}
                {selected?.stage ? ` · ${selected.stage}` : ''}
                {selected?.rs63 != null ? ` · RS63 ${pct(selected.rs63)}` : ''}
                {' · '}
                {members.length} tickers ranked by RS · sales / EPS for review
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Click another row in the board below to switch themes.
              </p>
            </div>
            <MembersTable
              members={members}
              threshold={data?.earningsReactionThresholdPct ?? 10}
            />
          </section>

          <MicrosectorTable
            rows={microsectors}
            selectedKey={selectedKey}
            onSelect={selectMicrosector}
          />

          <TrendScoutPanel scout={data?.trendScout} />

          {data?.method?.length ? (
            <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h3 className="text-sm font-semibold text-zinc-300">Method</h3>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-500">
                {data.method.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
