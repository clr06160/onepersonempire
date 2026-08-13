'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import FlowPanel from '@/components/scanner/FlowPanel';
import FlowSummaryStrip from '@/components/scanner/FlowSummaryStrip';
import { FlowMiniBiasPie } from '@/components/scanner/flow-charts';
import type { FlowPublicSummary, FlowTickerPayload } from '@/lib/scanner-flow-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: 'viewer' | 'developer' };

type FlowListItem = {
  ticker: string;
  signal: string;
  summary: FlowPublicSummary;
  full?: FlowTickerPayload;
  accumulationScore: number;
};

type FlowBucket = 'bullish' | 'bearish' | 'mixed';

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function bucketForSignal(signal: string): FlowBucket {
  const upper = signal.toUpperCase();
  if (upper.includes('DISTRIBUTING')) return 'bearish';
  if (upper.includes('ACCUMULATING')) return 'bullish';
  return 'mixed';
}

function strengthWeight(strength: string) {
  if (strength === 'strong') return 3;
  if (strength === 'moderate') return 2;
  return 1;
}

function flowScore(summary: FlowPublicSummary): number {
  let score = 0;
  const add = (bias: string, strength: string, available: boolean) => {
    if (!available) return;
    const w = strengthWeight(strength);
    if (bias === 'accumulating' || bias === 'call_heavy') score += w;
    if (bias === 'distributing' || bias === 'put_heavy') score -= w;
  };
  add(summary.institutional.bias, summary.institutional.strength, summary.institutional.available);
  add(summary.volume.bias, summary.volume.strength, summary.volume.available);
  add(summary.options.bias, summary.options.strength, summary.options.available);
  return score;
}

function combinedLean(item: FlowListItem): number {
  const flow = flowScore(item.summary) / 9;
  if (item.summary.institutional.available || item.full?.institutional?.available) {
    return item.accumulationScore * 0.65 + flow * 0.35;
  }
  return flow;
}

function accumulationScore(summary: FlowPublicSummary, full?: FlowTickerPayload): number {
  const buy =
    summary.institutionBuyingUsd ??
    full?.institutional?.latestQuarterBuying ??
    full?.institutional?.yearBuying ??
    0;
  const sell =
    summary.institutionSellingUsd ??
    full?.institutional?.latestQuarterSelling ??
    full?.institutional?.yearSelling ??
    0;
  const total = buy + sell;
  if (total > 0) return (buy - sell) / total;
  return flowScore(summary) / 9;
}

function netLeanLabel(item: FlowListItem): string | null {
  const buy =
    item.summary.institutionBuyingUsd ??
    item.full?.institutional?.latestQuarterBuying ??
    item.full?.institutional?.yearBuying ??
    0;
  const sell =
    item.summary.institutionSellingUsd ??
    item.full?.institutional?.latestQuarterSelling ??
    item.full?.institutional?.yearSelling ??
    0;
  const total = buy + sell;
  if (total <= 0) return null;
  const pct = ((buy - sell) / total) * 100;
  return `13F net ${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% buy lean`;
}

function ownershipPct(summary: FlowPublicSummary, full?: FlowTickerPayload): number | null {
  const pct = summary.institutionalOwnershipPct ?? full?.institutional?.ownershipPct;
  return pct != null && !Number.isNaN(pct) ? pct : null;
}

function ownershipAsOf(summary: FlowPublicSummary, full?: FlowTickerPayload): string | null {
  const stamp = summary.institutionalOwnershipAsOf ?? full?.institutional?.ownershipAsOf;
  return stamp ? String(stamp) : null;
}

function sortFlowItems(items: FlowListItem[], bucket: FlowBucket): FlowListItem[] {
  return [...items].sort((a, b) => {
    const scoreDiff =
      bucket === 'bearish'
        ? a.accumulationScore - b.accumulationScore
        : b.accumulationScore - a.accumulationScore;
    if (scoreDiff !== 0) return scoreDiff;
    return a.ticker.localeCompare(b.ticker);
  });
}

function signalBadgeClass(signal: string) {
  const bucket = bucketForSignal(signal);
  if (bucket === 'bullish') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (bucket === 'bearish') return 'border-red-300 bg-red-50 text-red-800';
  return 'border-amber-300 bg-amber-50 text-amber-900';
}

function FlowLegend() {
  return (
    <details className="mb-4 rounded-xl border border-zinc-300 bg-white shadow-sm open:shadow-md">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
        How to read this page <span className="ml-1 font-normal text-zinc-500">(methodology &amp; legend)</span>
      </summary>
      <div className="space-y-4 border-t border-zinc-200 px-4 py-4 text-sm text-zinc-700">
        <p>
          Only <strong>today&apos;s scanner picks</strong> appear here. Each name gets a combined flow score from three
          inputs: <strong>13F institutional changes</strong>, <strong>~21-day up vs down volume</strong>, and{' '}
          <strong>today&apos;s options put/call bias</strong> (when available).
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3">
            <p className="font-semibold text-emerald-900">Signal labels (strongest → weakest bullish)</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-emerald-950">
              <li>
                <strong>ACCUMULATING</strong> — best: ≥2 flows bullish and none bearish (all agree institutions are
                net buying / volume supports / calls lean).
              </li>
              <li>
                <strong>MOSTLY ACCUMULATING</strong> — good: majority bullish but not unanimous (e.g. institutions +
                volume up, options neutral).
              </li>
              <li>
                <strong>MIXED</strong> — no clear edge; flows disagree or data is thin.
              </li>
              <li>
                <strong>MOSTLY DISTRIBUTING</strong> / <strong>DISTRIBUTING</strong> — mirror bearish (majority or
                unanimous selling pressure).
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <p className="font-semibold text-zinc-900">Mini pie on each card</p>
            <ul className="mt-2 space-y-1 text-xs leading-relaxed">
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                More green = stronger combined bullish lean (13F + volume + options)
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
                More red = stronger distributing lean
              </li>
              <li>~50/50 gray area = truly mixed; bullish column names should look visibly greener.</li>
            </ul>
            <p className="mt-3 font-semibold text-zinc-900">Ranking vs ownership</p>
            <p className="mt-1 text-xs leading-relaxed">
              <strong>Rank (#1, #2…)</strong> uses <strong>13F net buying vs selling dollars</strong> — who is
              accumulating or distributing. <strong>Inst % owned</strong> is separate (shares held ÷ float, last complete
              filing). Cards show ownership when available, otherwise the 13F buy lean used for ranking.
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          <strong>Inst % owned</strong> = 13F holder shares from the last <strong>complete</strong> filing quarter ÷
          shares outstanding. High values (90%+) are flagged as <strong>crowded</strong>. Rankings use flow ($), not
          ownership %.
        </p>
      </div>
    </details>
  );
}

function FlowTickerCard({
  item,
  rank,
  active,
  onSelect,
}: {
  item: FlowListItem;
  rank: number;
  active: boolean;
  onSelect: (ticker: string) => void;
}) {
  const owned = ownershipPct(item.summary, item.full);
  const ownedAsOf = ownershipAsOf(item.summary, item.full);
  const crowded = owned != null && owned >= 90;
  const lean = combinedLean(item);
  const leanLabel = netLeanLabel(item);

  return (
    <button
      type="button"
      onClick={() => onSelect(item.ticker)}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        active
          ? 'border-emerald-600 bg-emerald-50 shadow-sm ring-1 ring-emerald-600/30'
          : 'border-zinc-300 bg-white hover:border-zinc-500 hover:bg-zinc-50'
      }`}
    >
      <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-zinc-400">#{rank}</span>
      <FlowMiniBiasPie score={lean} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold text-zinc-900">{item.ticker}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${signalBadgeClass(item.signal)}`}
          >
            {item.signal}
          </span>
        </div>
        {owned != null ? (
          <p className={`mt-1 text-xs ${crowded ? 'font-semibold text-amber-800' : 'text-zinc-600'}`}>
            Inst {owned.toFixed(1)}% of shares
            {ownedAsOf ? ` (${ownedAsOf.slice(0, 7)})` : ''}
            {crowded ? ' · crowded' : ''}
          </p>
        ) : leanLabel ? (
          <p className="mt-1 text-xs text-zinc-600">{leanLabel}</p>
        ) : (
          <p className="mt-1 text-xs text-zinc-400">13F flow n/a</p>
        )}
      </div>
    </button>
  );
}

function FlowBucketColumn({
  title,
  subtitle,
  tone,
  items,
  activeTicker,
  onSelect,
}: {
  title: string;
  subtitle: string;
  tone: 'bullish' | 'bearish' | 'mixed';
  items: FlowListItem[];
  activeTicker: string;
  onSelect: (ticker: string) => void;
}) {
  const headerClass =
    tone === 'bullish'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'bearish'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-amber-200 bg-amber-50 text-amber-950';

  return (
    <section className="flex min-h-0 flex-col rounded-2xl border border-zinc-300 bg-white shadow-sm">
      <div className={`rounded-t-2xl border-b px-4 py-3 ${headerClass}`}>
        <h2 className="text-sm font-bold uppercase tracking-wide">{title}</h2>
        <p className="mt-0.5 text-xs opacity-80">
          {items.length} pick{items.length === 1 ? '' : 's'} · {subtitle}
        </p>
      </div>
      <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto p-3">
        {items.length ? (
          items.map((item, index) => (
            <FlowTickerCard
              key={item.ticker}
              item={item}
              rank={index + 1}
              active={activeTicker === item.ticker}
              onSelect={onSelect}
            />
          ))
        ) : (
          <p className="px-1 py-4 text-sm text-zinc-500">No scanner picks in this bucket today.</p>
        )}
      </div>
    </section>
  );
}

export default function OptionsInstitutionsClient() {
  const searchParams = useSearchParams();
  const urlTicker = (searchParams.get('ticker') || '').trim().toUpperCase();

  const [user, setUser] = useState<ScannerUser | null>(null);
  const [items, setItems] = useState<FlowListItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState('');
  const [flowMessage, setFlowMessage] = useState('');
  const [activeTicker, setActiveTicker] = useState('');
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState('');

  const isDeveloper = user?.role === 'developer';

  const itemMap = useMemo(() => new Map(items.map((item) => [item.ticker, item])), [items]);

  const grouped = useMemo(() => {
    const buckets: Record<FlowBucket, FlowListItem[]> = { bullish: [], bearish: [], mixed: [] };
    for (const item of items) {
      buckets[bucketForSignal(item.signal)].push(item);
    }
    return {
      bullish: sortFlowItems(buckets.bullish, 'bullish'),
      bearish: sortFlowItems(buckets.bearish, 'bearish'),
      mixed: sortFlowItems(buckets.mixed, 'mixed'),
    };
  }, [items]);

  const activeItem = activeTicker ? itemMap.get(activeTicker) : undefined;

  const selectTicker = useCallback((ticker: string) => {
    setActiveTicker(ticker.trim().toUpperCase());
    setBootError('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/scanner/flow', fetchInit);
        const payload = await response.json();
        if (!response.ok) {
          if (!cancelled) setBootError(payload?.message || payload?.error || 'Could not load scanner flow data.');
          return;
        }

        if (!cancelled && payload?.user) setUser(payload.user);
        if (!cancelled) setGeneratedAt(String(payload?.generatedAt || payload?.data?.generatedAt || ''));
        if (!cancelled) setFlowMessage(String(payload?.message || payload?.data?.message || ''));

        const list: FlowListItem[] = [];

        if (payload?.data?.tickers && typeof payload.data.tickers === 'object') {
          for (const [ticker, row] of Object.entries(payload.data.tickers as Record<string, FlowTickerPayload>)) {
            const full = row as FlowTickerPayload;
            if (!full?.publicSummary) continue;
            list.push({
              ticker: ticker.toUpperCase(),
              signal: full.publicSummary.signal || full.signal || 'MIXED',
              summary: full.publicSummary,
              full,
              accumulationScore: accumulationScore(full.publicSummary, full),
            });
          }
        } else if (payload?.tickers && typeof payload.tickers === 'object') {
          for (const [ticker, row] of Object.entries(payload.tickers as Record<string, { publicSummary?: FlowPublicSummary }>)) {
            const summary = row?.publicSummary;
            if (!summary) continue;
            list.push({
              ticker: ticker.toUpperCase(),
              signal: summary.signal || 'MIXED',
              summary,
              accumulationScore: accumulationScore(summary),
            });
          }
        }

        if (!cancelled) {
          setItems(list);

          const preferred = urlTicker && list.some((item) => item.ticker === urlTicker) ? urlTicker : list[0]?.ticker || '';
          if (preferred) setActiveTicker(preferred);
        }
      } catch {
        if (!cancelled) setBootError('Could not load scanner flow data.');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlTicker]);

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-900 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[1200px]">
        <ScannerExtrasNav active="/scanner/options-institutions" theme="light" />

        <div className="mb-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Private scanner</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Options / institutions</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-700">
            Scanner picks ranked by institutional accumulation. Green-heavy pies = more 13F buying; red = selling. Click
            any row for the full breakdown below.
          </p>
          {generatedAt ? (
            <p className="mt-1 text-xs text-zinc-500">
              {items.length ? `${items.length} picks · ` : ''}Flow data as of {generatedAt.replace('T', ' ')}
            </p>
          ) : null}
        </div>

        <FlowLegend />

        {bootError ? (
          <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{bootError}</div>
        ) : null}
        {flowMessage && !items.length ? (
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{flowMessage}</div>
        ) : null}

        {bootLoading ? (
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">Loading scanner flow…</div>
        ) : items.length ? (
          <>
            <div className="mb-4 grid gap-4 lg:grid-cols-3">
              <FlowBucketColumn
                title="More bullish"
                subtitle="ranked by 13F buy vs sell $"
                tone="bullish"
                items={grouped.bullish}
                activeTicker={activeTicker}
                onSelect={selectTicker}
              />
              <FlowBucketColumn
                title="Mixed / unclear"
                subtitle="no dominant lean"
                tone="mixed"
                items={grouped.mixed}
                activeTicker={activeTicker}
                onSelect={selectTicker}
              />
              <FlowBucketColumn
                title="More bearish"
                subtitle="ranked by 13F sell vs buy $"
                tone="bearish"
                items={grouped.bearish}
                activeTicker={activeTicker}
                onSelect={selectTicker}
              />
            </div>

            {activeItem ? (
              <div className="mt-2">
                {isDeveloper && activeItem.full ? (
                  <FlowPanel data={activeItem.full} />
                ) : (
                  <FlowSummaryStrip
                    ticker={activeItem.ticker}
                    summary={activeItem.summary}
                    showLink={false}
                    compact={false}
                  />
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">
                Select a scanner pick above to view flow details.
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-zinc-300 bg-white p-5 text-sm text-zinc-700">
            Data is refreshing. Check back shortly.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href="/scanner" className="font-semibold text-emerald-700 hover:text-emerald-800">
            ← Back to scanner
          </Link>
          <Link href="/scanner/charts" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Charts
          </Link>
          {user ? (
            <span className="text-zinc-600">
              Signed in as {user.email} ({user.role})
            </span>
          ) : null}
        </div>
      </div>
    </main>
  );
}
