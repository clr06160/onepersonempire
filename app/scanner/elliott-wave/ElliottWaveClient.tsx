'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';
import type { ElliottWaveMarket, ElliottWavePayload, ElliottWaveRoadmap } from '@/lib/scanner-elliott-wave-data';

const EW_GUIDE_URL =
  'https://www.tradingview.com/chart/BTCUSD/xepjxoEQ-A-Comprehensive-Guide-to-Elliott-Wave-Rules-Guidelines/';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function toneClass(tone?: string) {
  if (tone === 'clear') return 'text-emerald-300 border-emerald-800 bg-emerald-950/40';
  if (tone === 'caution') return 'text-amber-200 border-amber-800 bg-amber-950/40';
  return 'text-violet-200 border-violet-800 bg-violet-950/40';
}

function biasLabel(bias?: string) {
  switch (bias) {
    case 'bull':
      return 'Impulse up';
    case 'bear':
      return 'Corrective / down';
    case 'late':
      return 'Late cycle';
    case 'correcting':
      return 'Correction';
    default:
      return 'Mixed / watch';
  }
}

function fmtPrice(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—';
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

function pctFrom(price: number | null | undefined, base: number | null | undefined) {
  if (price == null || base == null || !base) return null;
  return ((price / base - 1) * 100).toFixed(1);
}

const MARKET_GROUP_ORDER = ['US equities', 'Hot sectors', 'Metals'] as const;

function ProbabilityPanel({
  probabilities,
  consensus,
  highTarget,
  lowTarget,
}: {
  probabilities?: ElliottWaveMarket['probabilities'];
  consensus?: ElliottWaveMarket['sourceConsensus'];
  highTarget: number | null;
  lowTarget: number | null;
}) {
  const ph = probabilities?.probHighFirst;
  const pl = probabilities?.probLowFirst;
  if (ph == null && pl == null) return null;

  const likely = probabilities?.likelyFirst;
  const headline =
    likely === 'high'
      ? 'Upside target more likely first'
      : likely === 'low'
        ? 'Correction / low target more likely first'
        : 'Targets roughly balanced — no clear first touch';

  return (
    <div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Which target first?</p>
      <p className="mt-1 text-sm text-zinc-200">{headline}</p>
      {(ph != null || pl != null) && (
        <div className="mt-3 space-y-2">
          {ph != null && highTarget != null ? (
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-green-400">High ${fmtPrice(highTarget)} first</span>
                <span className="font-mono text-green-300">{ph}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-green-500/80" style={{ width: `${ph}%` }} />
              </div>
            </div>
          ) : null}
          {pl != null && lowTarget != null ? (
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-red-400">Low ${fmtPrice(lowTarget)} first</span>
                <span className="font-mono text-red-300">{pl}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full bg-red-500/80" style={{ width: `${pl}%` }} />
              </div>
            </div>
          ) : null}
        </div>
      )}
      {consensus?.summary ? (
        <p className="mt-2 text-xs text-zinc-400">
          Analyst consensus ({consensus.agreement || 'n/a'}): {consensus.summary}
        </p>
      ) : null}
      {probabilities?.drivers?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-zinc-500">
          {probabilities.drivers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-[10px] text-zinc-600">
        Subjective blend — local wave count + tagged X/FXStreet votes. Not a trade signal.
      </p>
    </div>
  );
}

function TargetBox({
  kind,
  label,
  price,
  close,
  pctBase,
  title,
}: {
  kind: 'high' | 'low' | 'support';
  label: string;
  price: number;
  close?: number;
  pctBase?: number;
  title?: string;
}) {
  const base = pctBase ?? close;
  const delta = pctFrom(price, base);
  const styles =
    kind === 'high'
      ? { box: 'border-green-900/80 bg-green-950/30', title: 'text-green-400', price: 'text-green-200', delta: 'text-green-300/80' }
      : kind === 'support'
        ? { box: 'border-amber-900/70 bg-amber-950/20', title: 'text-amber-400', price: 'text-amber-100', delta: 'text-amber-300/80' }
        : { box: 'border-red-900/80 bg-red-950/30', title: 'text-red-400', price: 'text-red-200', delta: 'text-red-300/80' };
  const defaultTitle = kind === 'high' ? 'Extension top' : kind === 'support' ? 'Structure support' : 'Correction landing';
  return (
    <div className={`flex-1 min-w-[140px] rounded-lg border px-3 py-2 ${styles.box}`}>
      <div className={`text-xs font-semibold uppercase tracking-wide ${styles.title}`}>{title ?? defaultTitle}</div>
      <div className={`mt-1 font-mono text-lg font-bold ${styles.price}`}>${fmtPrice(price)}</div>
      <div className="text-xs text-zinc-400">{label}</div>
      {delta != null ? (
        <div className={`text-xs ${styles.delta}`}>
          {Number(delta) >= 0 ? '+' : ''}
          {delta}%
          {pctBase != null && kind === 'low' ? ' from extension top' : ' from here'}
        </div>
      ) : null}
    </div>
  );
}

function WaveRoadmapPanel({ roadmap, close }: { roadmap?: ElliottWaveRoadmap | null; close?: number }) {
  if (!roadmap?.steps?.length) return null;

  const statusLabel = (s?: string) => {
    if (s === 'here') return 'You are here';
    if (s === 'next') return 'Next';
    if (s === 'past') return 'Past';
    return 'Ahead';
  };

  const statusClass = (s?: string) => {
    if (s === 'here') return 'border-violet-700 bg-violet-950/40 text-violet-200';
    if (s === 'next') return 'border-amber-800 bg-amber-950/30 text-amber-200';
    if (s === 'past') return 'border-zinc-800 bg-zinc-900/30 text-zinc-500';
    return 'border-zinc-800 bg-zinc-950/40 text-zinc-300';
  };

  return (
    <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/20 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{roadmap.modeLabel}</p>
        {roadmap.currentWave ? (
          <span className="font-mono text-xs text-zinc-500">Count: wave {roadmap.currentWave}</span>
        ) : null}
      </div>
      {roadmap.modeNote ? <p className="mt-1 text-xs text-zinc-500">{roadmap.modeNote}</p> : null}
      <ul className="mt-3 space-y-2">
        {roadmap.steps.map((step) => {
          const delta = pctFrom(step.price, close);
          return (
            <li
              key={step.id ?? `${step.wave}-${step.point}`}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm ${statusClass(step.status)}`}
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {step.label}
                  <span className="ml-2 text-[10px] uppercase tracking-wide opacity-70">{statusLabel(step.status)}</span>
                </div>
                {step.hint ? <div className="text-xs opacity-75">{step.hint}</div> : null}
              </div>
              <div className="text-right font-mono">
                <div className="font-semibold">${fmtPrice(step.price)}</div>
                {delta != null ? (
                  <div className="text-xs opacity-80">
                    {Number(delta) >= 0 ? '+' : ''}
                    {delta}%
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-zinc-600">Model levels from local count — not a trade signal. C is often the deeper leg.</p>
    </div>
  );
}

function MarketCard({ market }: { market: ElliottWaveMarket }) {
  const ew = market.elliott;
  const turn = market.turn;
  const price = market.price;

  if (market.error) {
    return (
      <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-zinc-400">
        <h3 className="text-lg font-semibold text-zinc-200">{market.label}</h3>
        <p className="mt-2 text-sm">{market.error}</p>
      </article>
    );
  }

  const dir = ew?.direction === 'up' ? '↑' : ew?.direction === 'down' ? '↓' : '—';
  const ch = price?.change1dPct ?? 0;
  const chClass = ch >= 0 ? 'text-emerald-400' : 'text-red-400';

  const highTarget = ew?.primaryHigh ?? ew?.waveHigh ?? null;
  const lowTarget = ew?.primaryLow ?? ew?.waveLow ?? null;
  const highLabel = ew?.primaryHighLabel ?? 'Fib extension';
  const lowLabel = ew?.primaryLowLabel ?? 'Correction zone';
  const supportTarget = ew?.supportLow ?? null;
  const supportLabel = ew?.supportLowLabel ?? 'First support / W4';
  const deepSupport = ew?.deepSupportLow ?? null;
  const lateW5 = /^ew5/i.test(ew?.rawLabel ?? '');

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{market.group}</div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">
            {market.label}{' '}
            <span className="font-mono text-sm font-normal text-zinc-500">{market.ticker}</span>
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{market.role}</p>
          {market.proxyNote ? <p className="mt-1 text-xs text-amber-400/90">{market.proxyNote}</p> : null}
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-semibold text-zinc-100">${fmtPrice(price?.close)}</div>
          <div className={`text-sm font-semibold ${chClass}`}>
            {ch >= 0 ? '+' : ''}
            {ch.toFixed(2)}% 1d
          </div>
        </div>
      </div>

      <div className={`mt-4 rounded-lg border px-4 py-3 ${toneClass(turn?.tone)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-wide">{ew?.label || 'EW ?'}</span>
          <span className="text-sm">{ew?.phase}</span>
          <span className="text-lg leading-none">{dir}</span>
        </div>
        <p className="mt-2 text-sm">{turn?.headline}</p>
        <p className="mt-1 text-xs opacity-80">{biasLabel(turn?.bias)}</p>
      </div>

      {market.interpretation ? (
        <p className="mt-3 text-sm leading-relaxed text-zinc-300">{market.interpretation}</p>
      ) : null}

      {ew?.waveRoadmap?.steps?.length ? (
        <WaveRoadmapPanel roadmap={ew.waveRoadmap} close={price?.close} />
      ) : (highTarget != null || lowTarget != null || supportTarget != null) ? (
        <div className="mt-4 space-y-2">
          {lateW5 && highTarget != null && lowTarget != null ? (
            <p className="text-xs text-zinc-500">
              Path: extension top → first support (tripwire) → correction landing.
              {deepSupport != null ? ' Deep W4 below correction = full impulse failure only.' : ''}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {highTarget != null && highTarget >= (price?.close ?? 0) * 0.995 ? (
              <TargetBox kind="high" label={highLabel} price={highTarget} close={price?.close} />
            ) : null}
            {lowTarget != null ? (
              <TargetBox
                kind="low"
                label={lowLabel}
                price={lowTarget}
                close={price?.close}
                pctBase={lateW5 && highTarget != null ? highTarget : price?.close}
              />
            ) : null}
            {supportTarget != null ? (
              <TargetBox kind="support" label={supportLabel} price={supportTarget} close={price?.close} />
            ) : null}
          </div>
        </div>
      ) : null}

      <ProbabilityPanel
        probabilities={market.probabilities}
        consensus={market.sourceConsensus}
        highTarget={highTarget}
        lowTarget={lowTarget}
      />

      {(ew?.targets?.length ?? 0) > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
          {ew?.targets?.map((t) => (
            <span
              key={`${t.label}-${t.price}`}
              className={`rounded px-2 py-1 ${
                t.kind === 'high'
                  ? 'bg-green-950/40 text-green-300'
                  : t.kind === 'support'
                    ? 'bg-amber-950/40 text-amber-300'
                    : t.kind === 'deep'
                      ? 'bg-zinc-800/60 text-zinc-400'
                      : t.kind === 'correction'
                        ? 'bg-red-950/40 text-red-300'
                        : 'bg-red-950/40 text-red-300'
              }`}
            >
              {t.label}: ${fmtPrice(t.price)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-400">
        <span>50 MA: {price?.above50Ma == null ? '—' : price.above50Ma ? 'above' : 'below'}</span>
        <span>200 MA: {price?.above200Ma == null ? '—' : price.above200Ma ? 'above' : 'below'}</span>
      </div>

      {(market.ewResearchers?.length ?? 0) > 0 || (market.recentEwPosts?.length ?? 0) > 0 ? (
        <div className="mt-4 rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Pro EW — follow on X</p>
          {market.ewResearchers?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {market.ewResearchers.map((r) => (
                <a
                  key={r.id || r.xHandle || r.name}
                  href={r.xUrl || r.site || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={r.notes || undefined}
                  className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-sky-300 hover:border-sky-700 hover:text-sky-200"
                >
                  {r.xHandle ? `@${r.xHandle}` : r.name}
                  {r.cadence === 'weekly' ? ' · weekly' : ''}
                </a>
              ))}
            </div>
          ) : null}
          {market.recentEwPosts?.length ? (
            <ul className="mt-2 space-y-1.5 text-xs">
              {market.recentEwPosts.slice(0, 5).map((post) => (
                <li key={post.url}>
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:text-sky-200"
                  >
                    {post.pinned ? '★ ' : ''}
                    {post.label || post.url}
                    {post.targetBias === 'high_first' ? ' ↑' : post.targetBias === 'low_first' ? ' ↓' : ''}
                  </a>
                  {post.stanceNote ? (
                    <span className="mt-0.5 block text-[10px] text-zinc-500">{post.stanceNote}</span>
                  ) : null}
                  {post.publishedAt ? (
                    <span className="ml-2 text-zinc-600">{post.publishedAt}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {market.ewFeedAt ? (
            <p className="mt-2 text-[10px] text-zinc-600">Feed checked {new Date(market.ewFeedAt).toLocaleString()}</p>
          ) : null}
        </div>
      ) : market.externalLinks?.length ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {market.externalLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-300 hover:text-sky-200"
            >
              {link.label} ↗
            </a>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export default function ElliottWaveClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ElliottWavePayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch('/api/scanner/elliott-wave', fetchInit);
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload.error || 'Could not load Elliott Wave dashboard.');
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

  const overall = data?.overall;
  const markets = data?.markets ?? [];

  const marketsByGroup = useMemo(() => {
    const map = new Map<string, ElliottWaveMarket[]>();
    for (const market of markets) {
      const group = market.group || 'Other';
      const list = map.get(group) ?? [];
      list.push(market);
      map.set(group, list);
    }
    const ordered: Array<{ group: string; markets: ElliottWaveMarket[] }> = [];
    for (const group of MARKET_GROUP_ORDER) {
      const list = map.get(group);
      if (list?.length) ordered.push({ group, markets: list });
      map.delete(group);
    }
    for (const [group, list] of map) {
      if (list.length) ordered.push({ group, markets: list });
    }
    return ordered;
  }, [markets]);

  return (
    <>
      <ScannerExtrasNav active="/scanner/elliott-wave" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading Elliott Wave dashboard…</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-violet-300 hover:text-violet-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-5">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-2xl font-semibold">Market turn read</h2>
            <p className="text-sm text-zinc-400">
              As of {data?.asOf || 'n/a'} · logged in as {user.email}
            </p>
            {data?.generatedAt ? (
              <p className="text-xs text-zinc-500">Snapshot {new Date(data.generatedAt).toLocaleString()}</p>
            ) : null}
            {data?.ewFeedAt ? (
              <p className="text-xs text-zinc-600">
                EW X feed refreshed {new Date(data.ewFeedAt).toLocaleString()}
              </p>
            ) : null}
            {error ? <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-4 text-red-200">{error}</p> : null}
            {data?.message && !markets.length ? (
              <p className="mt-4 rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">{data.message}</p>
            ) : null}
            {data?.externalNote ? <p className="mt-3 text-sm text-zinc-400">{data.externalNote}</p> : null}
            <p className="mt-4 text-sm text-zinc-300">
              Rules reference:{' '}
              <a
                href={data?.ewGuide?.url || EW_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-300 underline decoration-violet-500/50 underline-offset-2 hover:text-violet-200"
              >
                {data?.ewGuide?.title || 'Elliott Wave rules & guidelines (TradingView / XForceGlobal)'}
              </a>
              . Local counts follow zigzag + impulse validity from that guide.
            </p>
          </section>

          {overall ? (
            <section className={`rounded-2xl border p-6 ${toneClass(overall.tone)}`}>
              <h3 className="text-xl font-semibold">{overall.verdict}</h3>
              <p className="mt-2 text-sm">{overall.detail}</p>
              <p className="mt-2 text-sm opacity-90">
                EW5s5 on indexes = late-cycle exhaustion, not a timed top. Correction becomes likely if price loses
                wave-4 / 50 MA — not necessarily an immediate crash.
              </p>
              {overall.goldNote ? <p className="mt-2 text-sm opacity-90">{overall.goldNote}</p> : null}
            </section>
          ) : null}

          {marketsByGroup.length ? (
            <div className="space-y-8">
              {marketsByGroup.map(({ group, markets: groupMarkets }) => (
                <section key={group}>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">{group}</h3>
                  <div className="grid gap-5 lg:grid-cols-2">
                    {groupMarkets.map((market) => (
                      <MarketCard key={market.ticker} market={market} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
              No market data yet — rebuild with{' '}
              <code className="text-zinc-300">python scanners/elliott_wave_dashboard.py --upload</code>.
            </section>
          )}

          {data?.playbook?.length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h3 className="text-lg font-semibold text-zinc-100">How to use this page</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-400">
                {data.playbook.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {data?.note ? <p className="text-sm text-zinc-500">{data.note}</p> : null}
        </div>
      )}
    </>
  );
}
