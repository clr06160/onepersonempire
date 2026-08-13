'use client';

import { useCallback, useEffect, useState } from 'react';

import FirstPullbackRegimeCard from '@/components/scanner/FirstPullbackRegimeCard';
import type { AdaptiveMonitorPayload, MonitorInsight } from '@/lib/scanner-adaptive-monitor-data';
import type { FirstPullbackPayload } from '@/lib/scanner-first-pullback-data';

import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

type ScannerUser = { email: string; role: string };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'alert', label: 'Alerts' },
  { id: 'weakness', label: 'Weaknesses' },
  { id: 'try', label: 'Try next' },
  { id: 'trend', label: 'Trends' },
  { id: 'learning', label: 'Learning' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function verdictBannerClass(verdict?: string) {
  if (verdict === 'alert') return 'border-red-900/60 bg-red-950/40';
  if (verdict === 'watch') return 'border-amber-900/60 bg-amber-950/30';
  return 'border-emerald-900/60 bg-emerald-950/30';
}

function insightBorderClass(insight: MonitorInsight) {
  if (insight.severity === 'alert') return 'border-red-500/70';
  if (insight.severity === 'watch') return 'border-amber-500/70';
  if (insight.category === 'try') return 'border-violet-500/60';
  if (insight.category === 'trend') return 'border-emerald-500/60';
  return 'border-zinc-600';
}

function InsightCard({ insight }: { insight: MonitorInsight }) {
  return (
    <article className={`rounded-xl border-l-4 bg-zinc-900/80 p-4 ${insightBorderClass(insight)}`}>
      <div className="mb-2 flex flex-wrap gap-2">
        {insight.severity ? (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-bold uppercase text-zinc-300">
            {insight.severity}
          </span>
        ) : null}
        {insight.category ? (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-bold uppercase text-zinc-400">
            {insight.category}
          </span>
        ) : null}
      </div>
      <h3 className="font-semibold text-zinc-100">{insight.title}</h3>
      {insight.body ? <p className="mt-1 text-sm text-zinc-400">{insight.body}</p> : null}
      {insight.actionable ? <p className="mt-2 text-sm text-emerald-300">→ {insight.actionable}</p> : null}
      <p className="mt-2 text-xs text-zinc-500">
        {insight.confidence !== undefined ? `${Math.round((insight.confidence ?? 0.55) * 100)}% confidence` : null}
        {insight.seenCount ? ` · seen ${insight.seenCount}×` : null}
        {insight.source ? ` · ${insight.source}` : null}
      </p>
    </article>
  );
}

export default function AdaptiveMonitorClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<AdaptiveMonitorPayload | null>(null);
  const [fpData, setFpData] = useState<FirstPullbackPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('all');

  const load = useCallback(async () => {
    const [monitorRes, fpRes] = await Promise.all([
      fetch('/api/scanner/monitor', fetchInit),
      fetch('/api/scanner/first-pullback', fetchInit),
    ]);
    const payload = await monitorRes.json();
    const fpPayload = await fpRes.json().catch(() => null);
    setLoading(false);
    if (!monitorRes.ok) {
      setError(payload.error || 'Could not load adaptive monitor.');
      return;
    }
    setError('');
    setUser(payload.user || null);
    setData(payload.data || null);
    if (fpRes.ok && fpPayload?.data) {
      setFpData(fpPayload.data as FirstPullbackPayload);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const byCategory = data?.insights?.byCategory || {};
  const active = data?.insights?.active || [];

  const tabRows: Record<TabId, MonitorInsight[]> = {
    all: active,
    alert: byCategory.alert || [],
    weakness: byCategory.weakness || [],
    try: byCategory.try || [],
    trend: byCategory.trend || [],
    learning: byCategory.learning || [],
  };

  const rows = tabRows[tab];
  const operator = data?.operator || {};

  return (
    <>
      <ScannerExtrasNav active="/scanner/monitor" />

      {loading ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Loading monitor...</section>
      ) : !user ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-300">Sign in on the main scanner page first, then return here.</p>
          <a href="/scanner" className="mt-4 inline-flex text-emerald-300 hover:text-emerald-200">
            Go to scanner login
          </a>
        </section>
      ) : (
        <div className="space-y-8">
          {error ? (
            <section className="rounded-2xl border border-red-900/50 bg-red-950/20 p-4 text-red-200">{error}</section>
          ) : null}

          {data?.message && !data?.insights?.active?.length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-300">{data.message}</section>
          ) : null}

          <section className={`rounded-2xl border p-6 ${verdictBannerClass(operator.verdict)}`}>
            <p className="text-lg font-semibold">{operator.headline || 'Monitor active'}</p>
            <p className="mt-2 text-sm text-zinc-400">
              Health: {operator.healthVerdict || 'unknown'} · Cycle #{data?.cycleCount ?? 0} · Last cycle{' '}
              {data?.lastCycleAt || data?.generatedAt || 'n/a'}
            </p>
          </section>

          <FirstPullbackRegimeCard
            regime={fpData?.regime}
            track={fpData?.regimeTrack}
            showPageLink
            compact
          />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['Cycles', String(data?.cycleCount ?? 0)],
                ['Active insights', String(active.length)],
                ['Health', operator.healthVerdict || 'n/a'],
                ['Research gen', String(data?.researchSnapshot?.generationCount ?? '—')],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="text-2xl font-bold text-emerald-300">{value}</div>
                <div className="mt-1 text-sm text-zinc-500">{label}</div>
              </div>
            ))}
          </div>

          {(operator.recommendations || []).length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">What to do next</h2>
              <ul className="list-disc space-y-2 pl-5 text-zinc-300">
                {(operator.recommendations || []).map((rec) => (
                  <li key={rec}>{rec}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="mb-4 text-lg font-semibold">Insights</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium ${
                    tab === item.id
                      ? 'border-emerald-500 bg-emerald-950 text-emerald-200'
                      : 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {item.label} ({tabRows[item.id].length})
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {rows.length ? (
                rows.map((insight) => <InsightCard key={insight.fingerprint || insight.title} insight={insight} />)
              ) : (
                <p className="text-zinc-500">Nothing in this category yet.</p>
              )}
            </div>
          </section>

          {(data?.learningLog || []).length ? (
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-lg font-semibold">Learning log</h2>
              <div className="space-y-2 text-sm text-zinc-400">
                {(data?.learningLog || []).slice(0, 12).map((entry) => (
                  <div key={`${entry.at}-${entry.cycle}`} className="border-b border-zinc-800 pb-2">
                    <strong className="text-zinc-300">{entry.at}</strong> — {entry.summary}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </>
  );
}
