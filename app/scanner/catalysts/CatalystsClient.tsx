'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import TickerLink from '../TickerLink';
import type {
  CatalystBuildoutLayer,
  CatalystEmergingPhrase,
  CatalystForwardGroup,
  CatalystNewsItem,
  CatalystNextLayerClue,
  CatalystPayload,
  CatalystRow,
  CatalystThemeSummary,
} from '@/lib/scanner-catalysts-data';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const AI_LAYERS = ['Compute', 'Memory', 'Equipment', 'Networking', 'Power', 'Cloud Capex', 'Software ROI', 'Downstream Adoption'];

function pct(value?: number | null, digits = 1) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

function num(value?: number | null, digits = 1) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  return value.toFixed(digits);
}

function relativeTime(published?: string) {
  if (!published) return '';
  const parsed = new Date(published.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return published;
  const diffMs = Date.now() - parsed.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function directionClass(direction?: string) {
  if (direction === 'Rotating In' || direction === 'Up') return 'border-emerald-700 bg-emerald-950/50 text-emerald-100';
  if (direction === 'Rotating Out' || direction === 'Down') return 'border-red-800 bg-red-950/50 text-red-100';
  return 'border-zinc-700 bg-zinc-900 text-zinc-200';
}

function confirmationClass(value?: string) {
  if (value === 'Confirmed') return 'border-emerald-700 bg-emerald-950/50 text-emerald-100';
  if (value === 'Trying') return 'border-sky-700 bg-sky-950/50 text-sky-100';
  if (value === 'Exhausted') return 'border-amber-700 bg-amber-950/50 text-amber-100';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function gradeClass(value?: string) {
  if (value === 'Hard') return 'border-emerald-700 bg-emerald-950/50 text-emerald-100';
  if (value === 'Medium') return 'border-teal-700 bg-teal-950/50 text-teal-100';
  if (value === 'Soft') return 'border-sky-700 bg-sky-950/50 text-sky-100';
  return 'border-zinc-700 bg-zinc-900 text-zinc-300';
}

function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

function ThemeRadarLegend() {
  return (
    <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-xs text-zinc-400">
      <p className="font-semibold uppercase tracking-[0.18em] text-zinc-400">Legend — how to read theme cards</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="font-medium text-zinc-300">Direction (strongest → weakest)</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              <span className="text-emerald-300">Rotating In</span> — broad price strength + fresh Hard/Medium news
            </li>
            <li>
              <span className="text-emerald-200/80">Up</span> — more names working than fading; thinner story
            </li>
            <li>Mixed — no clear read</li>
            <li>
              <span className="text-red-200/80">Down</span> — more names soft than strong
            </li>
            <li>
              <span className="text-red-300">Rotating Out</span> — avoid; sponsorship leaving the theme
            </li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-zinc-300">Stage (lifecycle)</p>
          <ul className="mt-1.5 space-y-1">
            <li>Igniting — early, few names</li>
            <li>Spreading — building participation</li>
            <li>Leadership — many confirmed picks in theme</li>
            <li>Crowded — many names look extended</li>
            <li>Fading — direction Down / Rotating Out</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-zinc-300">Counts & order</p>
          <ul className="mt-1.5 space-y-1">
            <li>
              <span className="text-emerald-200/80">Confirmed</span> — price + volume follow-through
            </li>
            <li>Names — scanner picks tagged to this theme</li>
            <li>Cards sorted by most confirmed, then most names</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-zinc-300">Leaders</p>
          <ul className="mt-1.5 space-y-1">
            <li>Top 3 tickers in the theme</li>
            <li>
              <span className="text-zinc-300">1 month</span> — price return over ~21 trading days (shown on each leader)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ThemeCard({ theme, onSelect }: { theme: CatalystThemeSummary; onSelect: (theme: CatalystThemeSummary) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme)}
      className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-left transition hover:border-emerald-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{theme.parent || 'Theme'}</p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-100">{theme.label}</h3>
          <p className="mt-1 text-sm text-zinc-500">{theme.buildoutLayer || 'No layer'} layer</p>
        </div>
        <Pill className={directionClass(theme.direction)}>{theme.direction || 'Mixed'}</Pill>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Pill className="border-zinc-700 bg-zinc-900 text-zinc-300">{theme.stage || 'Mixed'}</Pill>
        <Pill className="border-zinc-700 bg-zinc-900 text-zinc-300">{theme.tickerCount || 0} names</Pill>
        <Pill className="border-emerald-800 bg-emerald-950/30 text-emerald-200">{theme.confirmedCount || 0} confirmed</Pill>
      </div>
      {theme.leaders?.length ? (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Leaders · 1 month return</p>
          <div className="mt-1.5 space-y-1 text-sm text-zinc-300">
            {theme.leaders.slice(0, 3).map((leader) => (
              <div key={leader.ticker} className="flex justify-between gap-3">
                <span>{leader.ticker}</span>
                <span className="text-zinc-400">
                  1 mo {pct(leader.return1mPct)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </button>
  );
}

function ThemeFlow({ layers }: { layers: CatalystBuildoutLayer[] }) {
  const byLayer = new Map<string, CatalystBuildoutLayer>();
  layers.forEach((layer) => {
    byLayer.set(layer.buildoutLayer, layer);
  });

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">AI buildout flow</p>
        <p className="mt-2 text-sm text-zinc-400">
          Watch whether leadership is still in compute/memory or rotating into networking, power, software, or adopters.
          Only current scanner picks count here — if a layer is empty, nothing in that bucket has momentum in the scan right now.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        {AI_LAYERS.map((layer) => {
          const card = byLayer.get(layer);
          return (
            <div key={layer} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-sm font-semibold text-zinc-200">{layer}</p>
              {card && card.tickerCount ? (
                <div className="mt-2">
                  <Pill className={directionClass(card.direction)}>{card.direction || 'Mixed'}</Pill>
                  <p className="mt-2 text-xs text-zinc-500">
                    {card.label} · {card.tickerCount || 0} scanner picks
                  </p>
                  {card.leaders?.length ? (
                    <p className="mt-2 text-xs text-zinc-400">
                      {card.leaders
                        .slice(0, 3)
                        .map((leader) => leader.ticker)
                        .join(', ')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-xs text-zinc-600">No scanner picks in this layer yet</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CatalystRowCard({ row, selected, onSelect }: { row: CatalystRow; selected: boolean; onSelect: (row: CatalystRow) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row)}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected ? 'border-emerald-500 bg-emerald-950/30' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <TickerLink ticker={row.ticker} className="text-base font-semibold text-emerald-200" />
        <Pill className={confirmationClass(row.marketConfirmation)}>{row.marketConfirmation || 'Unknown'}</Pill>
        <Pill className={gradeClass(row.evidenceGrade)}>{row.evidenceGrade || 'Theme'}</Pill>
        <span className="ml-auto text-xs text-zinc-500">score {row.evidenceScore ?? 0}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-300">{row.company || row.latestHeadline?.title || 'No company name'}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-500">
        <span>1W {pct(row.price?.return1wPct)}</span>
        <span>1M {pct(row.price?.return1mPct)}</span>
        <span>Vol {num(row.price?.volumeRatio20d, 2)}x</span>
      </div>
      {row.themes?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {row.themes.slice(0, 3).map((theme) => (
            <span key={theme.key} className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
              {theme.label}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

function NextLayerClues({ clues }: { clues: CatalystNextLayerClue[] }) {
  if (!clues.length) return null;
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">Next-layer clues</p>
      <p className="mt-2 text-sm text-zinc-400">Adjacent AI buildout layers that may be waking up while an upstream layer is still active.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {clues.map((clue) => (
          <div key={`${clue.fromLayer}-${clue.toLayer}`} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-zinc-200">{clue.fromLayer} → {clue.toLabel || clue.toLayer}</p>
              <Pill className={directionClass(clue.direction)}>{clue.direction || 'Mixed'}</Pill>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{clue.note}</p>
            {clue.tickers?.length ? <p className="mt-2 text-xs text-zinc-500">{clue.tickers.join(', ')}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function EmergingPhrases({ phrases, title = 'Needs review' }: { phrases: CatalystEmergingPhrase[]; title?: string }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">{title}</p>
      <p className="mt-2 text-sm text-zinc-400">
        Repeated phrases that are not yet formal themes. Review only — not verified catalysts.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {phrases.slice(0, 8).map((phrase) => (
          <div key={phrase.phrase} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold capitalize text-zinc-200">{phrase.phrase}</p>
              <Pill className="border-amber-700 bg-amber-950/40 text-amber-100">{phrase.tickerCount || 0} names</Pill>
            </div>
            {phrase.tickers?.length ? <p className="mt-1 text-xs text-zinc-500">{phrase.tickers.join(', ')}</p> : null}
            {phrase.example ? <p className="mt-2 line-clamp-2 text-xs text-zinc-500">{phrase.example}</p> : null}
          </div>
        ))}
        {!phrases.length ? <p className="text-sm text-zinc-500">No repeated unknown phrases yet.</p> : null}
      </div>
    </section>
  );
}

function NewsTape({ items }: { items: CatalystNewsItem[] }) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, CatalystNewsItem[]>();
    for (const item of items) {
      const tag = item.tags?.[0] || 'Other';
      const list = buckets.get(tag) || [];
      list.push(item);
      buckets.set(tag, list);
    }
    return Array.from(buckets.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [items]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">Catalyst tape</p>
      <p className="mt-2 text-sm text-zinc-400">Headlines grouped by catalyst type for current scanner picks.</p>
      <div className="mt-4 space-y-5">
        {grouped.slice(0, 6).map(([tag, groupItems]) => (
          <div key={tag}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{tag}</p>
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              {groupItems.slice(0, 4).map((item, index) => (
                <a
                  key={`${item.url || item.title}-${index}`}
                  href={item.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 hover:border-zinc-600"
                >
                  <div className="flex items-center gap-2">
                    {item.ticker ? <span className="font-semibold text-emerald-200">{item.ticker}</span> : null}
                    <span className="ml-auto text-xs text-zinc-500">{relativeTime(item.publishedDate)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-200">{item.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-zinc-600">{item.publisher || item.site || ''}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ForwardPanel({ groups }: { groups: CatalystForwardGroup[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">Forward test</p>
      <p className="mt-2 text-sm text-zinc-400">Live membership tracking by catalyst type and theme bucket.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {groups.slice(0, 9).map((group) => (
          <div key={group.key} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-zinc-200">{group.label}</p>
              <Pill className="border-zinc-700 bg-zinc-900 text-zinc-300">{group.openCount || 0} open</Pill>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-500">
              <span>Avg {pct(group.open?.avgReturnPct)}</span>
              <span>Hit {pct(group.open?.hitRatePct)}</span>
              <span>Closed {group.closedCount || 0}</span>
            </div>
            {group.closed?.outcomeBuckets ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                {Object.entries(group.closed.outcomeBuckets).map(([bucket, stats]) => (
                  <span key={bucket}>
                    {bucket} {stats.count || 0} · avg {pct(stats.avgReturnPct)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function TickerDossier({ row }: { row?: CatalystRow }) {
  if (!row) {
    return (
      <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-zinc-400">Select a catalyst row to inspect the evidence.</p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TickerLink ticker={row.ticker} className="text-2xl font-bold text-emerald-200" />
          <p className="mt-1 text-sm text-zinc-400">{row.company || 'Current scanner pick'}</p>
        </div>
        <Pill className={confirmationClass(row.marketConfirmation)}>{row.marketConfirmation}</Pill>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">Catalyst</p>
          <p className="mt-1 font-semibold text-zinc-200">{row.catalystType || 'Unknown'} · {row.evidenceGrade || 'Theme'}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">Action lens</p>
          <p className="mt-1 font-semibold text-zinc-200">{row.actionLens || 'Watch'}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">1 month</p>
          <p className="mt-1 font-semibold text-zinc-200">{pct(row.price?.return1mPct)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">Volume</p>
          <p className="mt-1 font-semibold text-zinc-200">{num(row.price?.volumeRatio20d, 2)}x 20d</p>
        </div>
      </div>

      {row.themes?.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Theme memberships</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {row.themes.map((theme) => (
              <Pill key={theme.key} className="border-zinc-700 bg-zinc-950 text-zinc-300">
                {theme.label}
              </Pill>
            ))}
          </div>
        </div>
      ) : null}

      {row.valuation?.runwayScore != null ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Valuation context</p>
            <a href="/scanner/valuations" className="text-xs text-emerald-300 hover:text-emerald-200">
              Open valuations
            </a>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <span className="text-zinc-400">Runway {num(row.valuation.runwayScore, 0)}</span>
            <span className="text-zinc-400">Risk {num(row.valuation.musicStopsRisk, 0)}</span>
            <span className="text-zinc-400">6W setup {num(row.valuation.sixWeekSetupScore, 0)}</span>
            <span className="text-zinc-400">{row.valuation.animal || 'No animal'}</span>
          </div>
          {row.valuation.note ? <p className="mt-2 text-xs text-zinc-500">{row.valuation.note}</p> : null}
        </div>
      ) : null}

      {row.nextEarnings?.earningsDate ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Upcoming earnings</p>
          <p className="mt-2 text-sm text-zinc-300">
            {row.nextEarnings.earningsDate}
            {row.nextEarnings.weekday ? ` · ${row.nextEarnings.weekday}` : ''}
          </p>
          {row.nextEarnings.threeDayReactionPct != null ? (
            <p className="mt-1 text-xs text-zinc-500">Last 3-day reaction {pct(row.nextEarnings.threeDayReactionPct)}</p>
          ) : null}
        </div>
      ) : null}

      {row.systems?.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Scanner systems</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {row.systems.slice(0, 5).map((system) => (
              <li key={system}>{system}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {row.headlines?.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Catalyst timeline</p>
          <div className="mt-2 space-y-2">
            {row.headlines.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>{relativeTime(item.publishedDate)}</span>
                  {item.tags?.length ? <span>{item.tags.join(', ')}</span> : null}
                </div>
                <p className="mt-1 text-sm text-zinc-300">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!row.headlines?.length && row.latestHeadline ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Latest evidence</p>
          <p className="mt-2 text-sm font-semibold text-zinc-200">{row.latestHeadline.title}</p>
          {row.latestHeadline.snippet ? <p className="mt-2 line-clamp-4 text-sm text-zinc-500">{row.latestHeadline.snippet}</p> : null}
        </div>
      ) : null}
    </aside>
  );
}

export default function CatalystsClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<CatalystPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/catalysts', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (response.status === 403 || payload.restricted) {
      setRestricted(true);
      setError('');
      return;
    }
    if (!response.ok) {
      setError(payload.error || 'Could not load scanner catalysts.');
      return;
    }
    setError('');
    setRestricted(false);
    setUser(payload.user || null);
    setData(payload.data || null);
    const firstTicker = payload.data?.rows?.[0]?.ticker || '';
    setSelectedTicker((current) => current || firstTicker);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const rows = useMemo(() => data?.rows || [], [data]);
  const themes = useMemo(() => data?.themes || [], [data]);
  const selected = useMemo(
    () => rows.find((row) => row.ticker === selectedTicker) || rows[0],
    [rows, selectedTicker],
  );
  const runningRows = data?.runningNow?.length ? data.runningNow : rows.slice(0, 16);

  return (
    <>
      <ScannerExtrasNav active="/scanner/catalysts" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading catalysts...</section>
      ) : restricted ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-semibold text-zinc-100">Owner-only catalysts</h2>
          <p className="mt-2 max-w-2xl text-zinc-300">
            This page uses licensed news snippets and is limited to the owner account.
          </p>
        </section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-2xl font-semibold">Theme radar</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {data?.themeCount || 0} active themes across {data?.tickerCount || 0} scanner picks.
                  {' '}
                  <span className="text-zinc-300">Leader percentages are 1 month price return</span> (~21 trading days, not YTD).
                </p>
                <ThemeRadarLegend />
                <p className="mt-3 text-xs text-zinc-500">Logged in as {user.email}</p>
              </div>
              {data?.generatedAt ? (
                <span className="shrink-0 text-xs text-zinc-500">Updated {new Date(data.generatedAt).toLocaleString()}</span>
              ) : null}
            </div>
            {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}
            {data?.message ? <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p> : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {themes.slice(0, 9).map((theme) => (
                <ThemeCard key={theme.key} theme={theme} onSelect={() => undefined} />
              ))}
            </div>
          </section>

          <ThemeFlow layers={data?.buildoutLayers || []} />

          <NextLayerClues clues={data?.nextLayerClues || []} />

          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">What is running now</p>
                <p className="mt-2 text-sm text-zinc-400">
                  Confirmed or high-evidence scanner picks with recent catalyst and price/volume support.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {runningRows.map((row) => (
                  <CatalystRowCard
                    key={row.ticker}
                    row={row}
                    selected={selected?.ticker === row.ticker}
                    onSelect={(next) => setSelectedTicker(next.ticker)}
                  />
                ))}
              </div>
            </section>
            <TickerDossier row={selected} />
          </div>

          <EmergingPhrases phrases={data?.needsReview?.length ? data.needsReview : data?.emergingPhrases || []} />

          {data?.catchingOn?.length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-400">What is catching on</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {data.catchingOn.slice(0, 6).map((theme) => (
                  <ThemeCard key={theme.key} theme={theme} onSelect={() => undefined} />
                ))}
              </div>
            </section>
          ) : null}

          {data?.forwardTest?.groups?.length ? <ForwardPanel groups={data.forwardTest.groups} /> : null}

          <NewsTape items={data?.news?.feed || []} />

          {data?.note ? <p className="text-xs text-zinc-600">{data.note}</p> : null}
        </div>
      )}
    </>
  );
}
