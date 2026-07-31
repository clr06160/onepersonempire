'use client';

import Script from 'next/script';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentLeaderboardRow } from '@/lib/scanner-agents';
import {
  agentRankBySystemId,
  formatAgentRankSuffix,
  sortSystemsByAgentRank,
} from '@/lib/scanner-agent-ranks';
import TickerLink from './TickerLink';
import { formatMeetingDate, nextUpcomingMeeting, rateLean, type FedWatchPayload } from '@/lib/fedwatch-utils';
import DreamTreeHeaderLogo from '@/components/scanner/DreamTreeHeaderLogo';
import ExecutionStatusBar from '@/components/scanner/ExecutionStatusBar';
import PickContextLegend from '@/components/scanner/PickContextLegend';
import PickNameRow from '@/components/scanner/PickNameRow';
import { SIDEBAR_NAV_GROUPS, sidebarLinkClass } from '@/components/scanner/sidebar-nav-groups';
import type { LensForwardSnapshot, PickContext } from '@/lib/scanner-pick-context';

type ScannerUser = {
  email: string;
  name?: string;
  picture?: string;
  role: 'viewer' | 'developer';
};

type GlobalRegime = {
  regimeLabel?: string;
  regimeBadge?: string;
  regimeScale?: number;
  scalePct?: number;
  footerTitle?: string;
  footerText?: string;
  footerAction?: string;
  footerDetail?: string;
  footerHint?: string;
  regimeReason?: string;
  painHorizonDays?: number;
  painProbPct?: string;
  backtestCagr?: string;
  backtestMaxDd?: string;
  backtestCalmar?: string;
};

type ScannerData = {
  connected?: boolean;
  generatedAt?: string;
  message?: string;
  liveScanOk?: boolean;
  liveScanError?: string;
  liveScanNote?: string;
  regimeBadges?: RegimeBadge[];
  globalRegime?: GlobalRegime;
  health?: ScannerHealth;
  adaptiveMonitor?: {
    verdict?: string;
    headline?: string;
    cycleCount?: number;
  };
  systems?: ScannerSystem[];
};

type ScannerHealthAlert = {
  code: string;
  severity: 'ok' | 'watch' | 'alert';
  message: string;
  detail?: string;
};

type ScannerHealth = {
  operator?: {
    verdict: 'ok' | 'watch' | 'alert';
    headline: string;
    recommendations?: string[];
  };
  alerts?: ScannerHealthAlert[];
  forwardPaper?: {
    metrics?: Record<string, number>;
    interpretation?: {
      roll20dPct?: number;
      roll20dBand?: Record<string, number>;
    };
  };
};

type RegimeBadge = {
  kind?: string;
  name?: string;
  action?: string;
  regimeBadge?: string;
  regimeLabel?: string;
  regimeReason?: string;
  detail?: string;
  tone?: string;
  scale?: number;
  scalePct?: number;
};

type DailyUniverseRow = {
  ticker: string;
  rank?: number;
  accelScore?: number;
  roc20Pct?: number;
  accel20Pct?: number;
  close?: number;
};

type DailyUniverseGroup = {
  key: string;
  universe?: string;
  label: string;
  top?: string[];
  rows?: DailyUniverseRow[];
  eligibleCount?: number;
  negativeCount?: number;
};

type ScannerSystem = {
  id: string;
  label: string;
  role: string;
  stats?: Record<string, string>;
  date?: string;
  top?: string[];
  dailyUniverses?: DailyUniverseGroup[];
  dailyBearUniverses?: DailyUniverseGroup[];
  watchDate?: string;
  watch?: string[];
  method?: string[];
  note?: string;
  isLive?: boolean;
  asOf?: string;
  powertrend?: string;
  powertrendOn?: boolean;
  regimeScale?: number;
  regimeLabel?: string;
  regimeBadge?: string;
  regimeReason?: string;
  overlayModule?: { line?: string };
  parentId?: string;
  isHoldVariant?: boolean;
  usesLedgerHoldings?: boolean;
  holdSince?: string;
  holdCadenceLabel?: string;
  holdReturnPct?: number;
  holdTickerReturns?: Record<string, number>;
};

function holdReturnToneClass(value?: number) {
  if (value == null || Number.isNaN(value)) return 'text-zinc-200';
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-300';
}

type EwOverlay = {
  generatedAt?: string;
  labelsBySystem?: Record<string, Record<string, string>>;
  message?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
  }
}

const scannerFetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

async function readResponseJson<T>(response: Response, fallback: T): Promise<T> {
  try {
    const text = await response.text();
    if (!text.trim()) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function regimeBadgeToneClass(tone?: string) {
  if (tone === 'cash') return 'border-red-800/80 bg-red-950/70 text-red-200';
  if (tone === 'half') return 'border-amber-700/80 bg-amber-950/50 text-amber-200';
  if (tone === 'full' || tone === 'clear') return 'border-emerald-700/80 bg-emerald-950/50 text-emerald-200';
  return 'border-zinc-700 bg-zinc-900 text-zinc-200';
}

function RegimeSignalBadge({ badge, symmetric }: { badge: RegimeBadge; symmetric?: boolean }) {
  const showBook =
    badge.kind !== 'powertrend' &&
    badge.kind !== 'sharp-pause' &&
    badge.kind !== 'learned' &&
    badge.scalePct != null;
  const actionLine = badge.kind === 'learned'
    ? badge.action || badge.regimeLabel
    : `${badge.action || badge.regimeLabel || ''}${showBook ? ` · book ${badge.scalePct}%` : ''}`.trim();

  return (
    <div
      className={`rounded-lg border px-3 py-2 ${regimeBadgeToneClass(badge.tone)} ${
        symmetric ? 'flex h-full min-h-[6rem] flex-col' : 'min-w-[160px] flex-1'
      }`}
      title={badge.detail || badge.regimeReason}
    >
      <div className="text-[11px] uppercase tracking-wide opacity-70">{badge.name}</div>
      <div className="text-sm font-semibold">{actionLine}</div>
      {badge.detail || badge.regimeReason ? (
        <div className="mt-1 text-xs opacity-80">{badge.detail || badge.regimeReason}</div>
      ) : null}
    </div>
  );
}

function formatDashboardDate(iso?: string): string {
  if (!iso) return '';
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : iso;
}

type ScannerPageClientProps = {
  googleClientId: string;
  /** Design preview: Dream Tree header + balanced grids only — same data and sections. */
  previewPolish?: boolean;
};

export default function ScannerPageClient({
  googleClientId: initialGoogleClientId,
  previewPolish = false,
}: ScannerPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stayOnSystems = searchParams.get('systems') === '1';
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<ScannerData | null>(null);
  const [ewOverlay, setEwOverlay] = useState<EwOverlay | null>(null);
  const [fedwatch, setFedwatch] = useState<FedWatchPayload | null>(null);
  const [pickContextByTicker, setPickContextByTicker] = useState<Record<string, PickContext>>({});
  const [lensSnapshots, setLensSnapshots] = useState<LensForwardSnapshot[]>([]);
  const [developerMessage, setDeveloperMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedSystemId, setSelectedSystemId] = useState('');
  const [agentLeaderboard, setAgentLeaderboard] = useState<AgentLeaderboardRow[]>([]);
  const [googleClientId, setGoogleClientId] = useState(initialGoogleClientId);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [scannerFileCount, setScannerFileCount] = useState(0);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [interestEmail, setInterestEmail] = useState('');
  const [interestMessage, setInterestMessage] = useState('');
  const [interestSaving, setInterestSaving] = useState(false);
  const [interestMessageOut, setInterestMessageOut] = useState('');
  const [interestError, setInterestError] = useState('');
  const interestOpenedAtRef = useRef(Date.now());
  const renderAttemptsRef = useRef(0);
  const tryRenderGoogleButtonRef = useRef<() => void>(() => {});

  const submitInterest = useCallback(
    async (honeypot?: { company?: string; website?: string }) => {
      setInterestSaving(true);
      setInterestError('');
      setInterestMessageOut('');
      try {
        const response = await fetch('/api/scanner/waitlist', {
          ...scannerFetchInit,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: interestEmail,
            message: interestMessage,
            company: honeypot?.company || '',
            website: honeypot?.website || '',
            dwellMs: Date.now() - interestOpenedAtRef.current,
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          setInterestError(payload.error || 'Could not send.');
          return;
        }
        setInterestMessageOut(payload.message || 'Thanks — we got your note.');
        setInterestMessage('');
      } catch {
        setInterestError('Could not send.');
      } finally {
        setInterestSaving(false);
      }
    },
    [interestEmail, interestMessage],
  );

  const onScannerSelect = useCallback(
    (value: string) => {
      if (value === '__flight-deck__') {
        router.push('/scanner/cockpit');
        return;
      }
      setSelectedSystemId(value);
    },
    [router],
  );

  const loadScannerData = useCallback(async () => {
    try {
      const [scannerResponse, ewResponse, fedResponse, agentsResponse] = await Promise.all([
        fetch('/api/scanner/data', scannerFetchInit),
        fetch('/api/scanner/ew', scannerFetchInit),
        fetch('/api/scanner/fedwatch', scannerFetchInit),
        fetch('/api/scanner/agents', scannerFetchInit),
      ]);
      if (scannerResponse.status === 401) return;
      const payload = await readResponseJson(scannerResponse, { error: 'Could not load scanner data.' } as {
        user?: ScannerUser | null;
        data?: ScannerData | null;
        pickContext?: { byTicker?: Record<string, PickContext>; lenses?: LensForwardSnapshot[] };
        error?: string;
      });
      if (!scannerResponse.ok) {
        setError(payload.error || 'Could not load scanner data.');
        return;
      }
      const ewPayload = ewResponse.ok
        ? await readResponseJson(ewResponse, { overlay: { labelsBySystem: {} } })
        : { overlay: { labelsBySystem: {} } };
      const fedPayload = fedResponse.ok
        ? await readResponseJson(fedResponse, { data: null })
        : { data: null };
      const agentsPayload = agentsResponse.ok
        ? await readResponseJson(agentsResponse, { data: { leaderboard: [] } })
        : { data: { leaderboard: [] } };
      const leaderboard = (agentsPayload.data?.leaderboard || []) as AgentLeaderboardRow[];
      setError('');
      setUser(payload.user || null);
      setData(payload.data || null);
      setEwOverlay(ewPayload.overlay || { labelsBySystem: {} });
      setFedwatch(fedPayload.data || null);
      setPickContextByTicker(payload.pickContext?.byTicker || {});
      setLensSnapshots(payload.pickContext?.lenses || []);
      setAgentLeaderboard(leaderboard);
      const systems = (payload.data?.systems || []) as ScannerSystem[];
      if (systems.length) {
        const topSystemId = leaderboard[0]?.systemId;
        setSelectedSystemId((current) => {
          if (current) return current;
          if (topSystemId && systems.some((system) => system.id === topSystemId)) return topSystemId;
          return systems[0].id;
        });
      }
    } catch {
      setError('Could not load scanner data.');
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/session', scannerFetchInit);
      const payload = await readResponseJson(response, { user: null as ScannerUser | null });
      setUser(payload.user || null);
      return payload.user as ScannerUser | null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeveloperTools = useCallback(async () => {
    try {
      const response = await fetch('/api/scanner/developer', scannerFetchInit);
      const payload = await readResponseJson(response, { message: '', error: '', downloadUrl: '', scannerCount: 0 });
      setDeveloperMessage(payload.message || payload.error || '');
      setDownloadUrl(payload.downloadUrl || '');
      setScannerFileCount(Number(payload.scannerCount || 0));
    } catch {
      // Optional developer panel.
    }
  }, []);

  const handleCredential = useCallback(
    async (credential: string) => {
      setError('');
      const response = await fetch('/api/scanner/auth/login', {
        ...scannerFetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const payload = await readResponseJson(response, { error: 'Sign-in failed.' } as {
        user?: ScannerUser;
        error?: string;
      });
      if (!response.ok) {
        setError(payload.error || 'Sign-in failed.');
        return;
      }
      setUser(payload.user || null);
      if (!stayOnSystems) {
        router.replace('/scanner/cockpit');
        return;
      }
      await loadScannerData();
    },
    [loadScannerData, router, stayOnSystems],
  );

  const renderGoogleButton = useCallback(() => {
    const target = document.getElementById('google-signin-button');
    if (!target || !window.google || !googleClientId) return false;

    target.innerHTML = '';
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: (response) => handleCredential(response.credential),
    });
    window.google.accounts.id.renderButton(target, {
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
    });
    return true;
  }, [googleClientId, handleCredential]);

  const tryRenderGoogleButton = useCallback(() => {
    if (user || !googleClientId) return;
    if (renderGoogleButton()) {
      renderAttemptsRef.current = 0;
      return;
    }
    if (renderAttemptsRef.current >= 12) return;
    renderAttemptsRef.current += 1;
    window.setTimeout(() => tryRenderGoogleButtonRef.current(), 250);
  }, [googleClientId, renderGoogleButton, user]);

  useEffect(() => {
    tryRenderGoogleButtonRef.current = tryRenderGoogleButton;
  }, [tryRenderGoogleButton]);

  const logout = useCallback(async () => {
    await fetch('/api/scanner/auth/logout', { ...scannerFetchInit, method: 'POST' });
    setUser(null);
    setData(null);
    setEwOverlay(null);
    setFedwatch(null);
    setDeveloperMessage('');
    renderAttemptsRef.current = 0;
    window.setTimeout(tryRenderGoogleButton, 0);
  }, [tryRenderGoogleButton]);

  useEffect(() => {
    if (initialGoogleClientId) return;
    fetch('/api/scanner/config', scannerFetchInit)
      .then((response) => readResponseJson(response, { googleClientId: '' }))
      .then((payload) => {
        if (payload.googleClientId) setGoogleClientId(String(payload.googleClientId));
      })
      .catch(() => {
        // Keep the default empty state; the sign-in panel shows setup instructions.
      });
  }, [initialGoogleClientId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      // Run the session check and data load in parallel instead of waiting for
      // the session round-trip first. The data route re-verifies the session
      // server-side (and we ignore its 401 above), so this stays secure while
      // removing one sequential round-trip from the initial load.
      refreshSession();
      loadScannerData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadScannerData, refreshSession]);

  // Flight Deck is the subscriber home. Systems warehouse stays one click away via ?systems=1.
  useEffect(() => {
    if (loading || !user || stayOnSystems) return;
    router.replace('/scanner/cockpit');
  }, [loading, user, stayOnSystems, router]);

  useEffect(() => {
    if (loading || user || !googleClientId || !googleScriptReady) return;
    renderAttemptsRef.current = 0;
    tryRenderGoogleButton();
  }, [googleClientId, googleScriptReady, loading, tryRenderGoogleButton, user]);

  useEffect(() => {
    if (user?.role !== 'developer') return;
    const timer = window.setTimeout(() => {
      loadDeveloperTools();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDeveloperTools, user?.role]);

  const systems = data?.systems || [];
  const agentRanks = useMemo(() => agentRankBySystemId(agentLeaderboard), [agentLeaderboard]);
  const systemsForSelect = useMemo(
    () => sortSystemsByAgentRank(systems, agentRanks),
    [systems, agentRanks],
  );
  const selectedSystem = systems.find((system) => system.id === selectedSystemId) || systems[0];
  const isBearScanner = selectedSystem?.id === 'daily-raw-bear';
  const bearUniverseGroups = selectedSystem?.dailyBearUniverses;
  const ewLabels = (selectedSystem && ewOverlay?.labelsBySystem?.[selectedSystem.id]) || {};
  const powerBadge = (data?.regimeBadges || []).find((badge) => badge.kind === 'powertrend');
  const powerLabel =
    selectedSystem?.powertrend && selectedSystem.powertrend !== 'POWER TREND UNKNOWN'
      ? selectedSystem.powertrend
      : powerBadge?.regimeBadge || selectedSystem?.powertrend || 'POWER TREND UNKNOWN';
  const powerOn =
    selectedSystem?.powertrend && selectedSystem.powertrend !== 'POWER TREND UNKNOWN'
      ? Boolean(selectedSystem.powertrendOn)
      : powerBadge?.regimeLabel?.toUpperCase() === 'ON' || Boolean(selectedSystem?.powertrendOn);
  const nextMeeting = nextUpcomingMeeting(fedwatch);
  const nextLean = rateLean(nextMeeting);
  const health = data?.health;
  const healthVerdict = health?.operator?.verdict || 'ok';
  const healthTone =
    healthVerdict === 'alert'
      ? 'border-red-800 bg-red-950/50 text-red-100'
      : healthVerdict === 'watch'
        ? 'border-amber-800 bg-amber-950/40 text-amber-100'
        : 'border-emerald-800 bg-emerald-950/40 text-emerald-100';

  const regimeSignalsPanel =
    previewPolish && ((data?.regimeBadges || []).length > 0 || selectedSystem) ? (
      <div className="space-y-3 rounded-2xl border border-emerald-900/25 bg-zinc-900/90 p-5 shadow-inner shadow-emerald-950/10">
        <h2 className="text-lg font-semibold text-zinc-100">Regime signals</h2>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          What each overlay says right now
        </p>
        {selectedSystem ? (
          <div className="flex flex-wrap items-center gap-3">
            <span
              title="Based on IBD's Power Trend methodology (21-day EMA / 50-day MA trend conditions). Not affiliated with Investor's Business Daily."
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                powerOn
                  ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                  : 'border-red-800 bg-red-950 text-red-200'
              }`}
            >
              {powerLabel}
            </span>
            <span className="text-sm text-zinc-400">
              {selectedSystem.isLive ? 'Live scan' : 'Saved scan'} · as of{' '}
              {formatDashboardDate(selectedSystem.asOf || selectedSystem.date) ||
                selectedSystem.asOf ||
                selectedSystem.date ||
                'n/a'}
            </span>
            {nextLean && nextMeeting ? (
              <Link
                href="/scanner/fedwatch"
                title="Market-implied odds for the next FOMC meeting"
                className={`rounded-full border px-3 py-1 text-sm font-semibold transition hover:brightness-110 ${
                  nextLean.tone === 'hike'
                    ? 'border-amber-700 bg-amber-950 text-amber-200'
                    : nextLean.tone === 'cut'
                      ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                }`}
              >
                {nextLean.tone === 'hike' ? '↑ ' : nextLean.tone === 'cut' ? '↓ ' : ''}
                {nextLean.direction === 'hold'
                  ? `Fed hold ${nextLean.prob.toFixed(0)}%`
                  : `Upcoming ${nextLean.label.toLowerCase()} ${nextLean.prob.toFixed(0)}%`}
                <span className="ml-1 font-normal text-zinc-400">· {formatMeetingDate(nextMeeting.meetingDate)}</span>
              </Link>
            ) : null}
          </div>
        ) : null}
        {(data?.regimeBadges || []).length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(data?.regimeBadges || []).map((badge) => (
              <RegimeSignalBadge key={`${badge.kind}-${badge.name}`} badge={badge} symmetric />
            ))}
          </div>
        ) : null}
      </div>
    ) : !previewPolish && (data?.regimeBadges || []).length > 0 ? (
      <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Regime signals — what each overlay says right now
        </p>
        <div className="flex flex-wrap gap-2">
          {(data?.regimeBadges || []).map((badge) => (
            <RegimeSignalBadge key={`${badge.kind}-${badge.name}`} badge={badge} />
          ))}
        </div>
      </div>
    ) : null;

  const scaleOperatorPanel = health?.operator ? (
    <div className={`rounded-xl border p-4 ${healthTone}`}>
      <div
        className={
          previewPolish
            ? 'grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto]'
            : 'flex flex-wrap items-center justify-between gap-2'
        }
      >
        <h3 className={`text-sm font-semibold uppercase tracking-wide ${previewPolish ? 'text-center md:text-left' : ''}`}>
          Scale operator
        </h3>
        <span
          className={`rounded-full border border-current px-3 py-1 text-xs font-bold uppercase ${previewPolish ? 'justify-self-center md:justify-self-end' : ''}`}
        >
          {healthVerdict}
        </span>
      </div>
      <p className="mt-2 text-sm">{health.operator.headline}</p>
      {health.forwardPaper?.metrics?.roll20dPct != null ? (
        <p className="mt-2 text-xs opacity-90">
          Core paper book 20d: {health.forwardPaper.metrics.roll20dPct}% vs backtest band p10{' '}
          {health.forwardPaper.interpretation?.roll20dBand?.p10 ?? 'n/a'}%
        </p>
      ) : null}
      {!!health.alerts?.length && (
        <ul className="mt-3 space-y-1 text-sm">
          {health.alerts.slice(0, 4).map((alert) => (
            <li key={alert.code}>
              <span className="font-semibold uppercase">{alert.severity}</span>: {alert.message}
            </li>
          ))}
        </ul>
      )}
      <Link href="/scanner/monitor" className="mt-3 inline-flex text-sm text-violet-300 hover:text-violet-200">
        Full adaptive monitor →
      </Link>
    </div>
  ) : null;

  const forwardPaperPanel = lensSnapshots.length ? (
    <ExecutionStatusBar lenses={lensSnapshots} symmetric={previewPolish} />
  ) : null;

  if (!loading && !user) {
    const dreamTreeHost =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'dreamtreestocks.com' ||
        window.location.hostname === 'www.dreamtreestocks.com');
    const features: { title: string; desc: string; chip: string }[] = [
      {
        title: 'Market Trees',
        desc: 'Watch whole indices as one living canopy — scrub year by year as the tree blooms or withers with returns.',
        chip: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
      },
      {
        title: 'Flight Deck',
        desc: 'Your home book — one meta-agent synthesis with a live scoreboard and clear next step.',
        chip: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
      },
      {
        title: 'System Scanner',
        desc: 'Daily ranked picks, quality-filtered across universes — the warehouse behind the Flight Deck.',
        chip: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
      },
      {
        title: 'Charts',
        desc: 'Clean daily charts with fundamentals overlays.',
        chip: 'bg-amber-500/10 text-amber-300 ring-amber-500/30',
      },
      {
        title: 'Adaptive Monitor',
        desc: 'A live regime read plus an honest grade of the system against its own backtest.',
        chip: 'bg-violet-500/10 text-violet-300 ring-violet-500/30',
      },
      {
        title: 'Agent Tournament',
        desc: 'Strategies compete head-to-head — only the ones that actually perform survive.',
        chip: 'bg-sky-500/10 text-sky-300 ring-sky-500/30',
      },
      {
        title: 'Proprietary Fundamentals',
        desc: 'Unique signals most screeners miss — earnings-reaction scoring and Rule of 40, so weak names never make the cut.',
        chip: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30',
      },
      {
        title: 'COT Report',
        desc: 'See how the big money is positioned before you take the other side of it.',
        chip: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
      },
    ];

    return (
      <main className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => {
            setGoogleScriptReady(true);
            window.setTimeout(tryRenderGoogleButton, 0);
          }}
        />

        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-emerald-600/20 blur-[120px]" />
          <div className="absolute -right-32 top-1/3 h-[32rem] w-[32rem] rounded-full bg-sky-600/15 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-600/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.10) 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6">
          <header className="flex items-center justify-between py-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-lg font-black text-emerald-400 ring-1 ring-emerald-500/30">
                ⌁
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-200">
                {dreamTreeHost ? (
                  <>
                    Dream Tree <span className="text-emerald-400">Stocks</span>
                  </>
                ) : (
                  <>
                    OnePersonEmpire <span className="text-zinc-500">Scanner</span>
                  </>
                )}
              </span>
            </div>
            <span className="rounded-full border border-zinc-700/80 bg-zinc-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 backdrop-blur">
              Invite only
            </span>
          </header>

          <section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                {dreamTreeHost ? 'Private · invite only' : 'Private market intelligence'}
              </div>

              <h1 className="text-balance text-5xl font-black leading-[1.03] tracking-tight sm:text-6xl">
                {dreamTreeHost ? (
                  <>
                    One book.
                    <span className="block bg-gradient-to-r from-emerald-300 via-emerald-400 to-sky-400 bg-clip-text pb-2 leading-[1.12] text-transparent">
                      Every morning.
                    </span>
                  </>
                ) : (
                  <>
                    Where serious traders
                    <span className="block bg-gradient-to-r from-emerald-300 via-emerald-400 to-sky-400 bg-clip-text pb-2 leading-[1.12] text-transparent">
                      find their edge.
                    </span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-400">
                {dreamTreeHost
                  ? 'Dream Tree Stocks turns the market into a living canopy and a single Flight Deck book — momentum with a survival brake. Built for traders who hate big drawdowns.'
                  : 'A private stock scanner that ranks the market every morning — quality-filtered, regime-aware, and forward-tracked. No hype. No hindsight. Just the names worth your attention, with the discipline to tell you when to sit in cash.'}
              </p>

              <ul className="mt-8 space-y-3">
                {(dreamTreeHost
                  ? [
                      'Flight Deck — one meta-agent book with a clear “what to do today” line',
                      'Market Trees — watch whole indices bloom or wither year by year',
                      'Monthly cash brake when the stretch gets ugly (−5%)',
                      'Invite-only access — no public free-for-all',
                    ]
                  : [
                      'Daily ranked picks across multiple universes — rebuilt before the open',
                      'Regime-aware scaling that says when to push and when to hold cash',
                      'Charts, fundamentals, and COT positioning in one private cockpit',
                      'An adaptive monitor that grades the system against its own backtest — honestly',
                    ]
                ).map((line) => (
                  <li key={line} className="flex items-start gap-3 text-[15px] text-zinc-300">
                    <svg className="mt-0.5 h-5 w-5 flex-none text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {line}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-8">
                {([
                  ['6', 'intelligence tools'],
                  ['Forward-tracked', 'real results, not just backtests'],
                  ['Regime-aware', 'tells you when to sit in cash'],
                ] as const).map(([stat, label]) => (
                  <div key={label}>
                    <div className="text-2xl font-bold text-white">{stat}</div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:justify-self-end space-y-4">
              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/40 to-zinc-950/80 p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400">
                  Get on the list
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-zinc-50">Tell us you’re interested</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Email + a short note beats cold spam. Real traders write a sentence. We’ll invite from here — not a public open door.
                </p>
                <form
                  className="mt-5 space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const fd = new FormData(event.currentTarget);
                    void submitInterest({
                      company: String(fd.get('company') || ''),
                      website: String(fd.get('website') || ''),
                    });
                  }}
                >
                  <label className="block">
                    <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">Email</span>
                    <input
                      type="email"
                      required
                      value={interestEmail}
                      onChange={(e) => setInterestEmail(e.target.value)}
                      placeholder="you@email.com"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] uppercase tracking-wide text-zinc-500">
                      Why you’re interested
                    </span>
                    <textarea
                      value={interestMessage}
                      onChange={(e) => setInterestMessage(e.target.value)}
                      placeholder="How you trade, what you want from Flight Deck / the trees…"
                      rows={4}
                      className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500"
                    />
                  </label>
                  {/* Honeypots — off-screen; bots fill them, humans never see them */}
                  <div
                    aria-hidden
                    style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
                  >
                    <input type="text" name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                  </div>
                  <button
                    type="submit"
                    disabled={interestSaving}
                    className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {interestSaving ? 'Sending…' : 'Request an invite'}
                  </button>
                </form>
                {interestMessageOut ? (
                  <p className="mt-3 text-sm text-emerald-300">{interestMessageOut}</p>
                ) : null}
                {interestError ? <p className="mt-3 text-sm text-red-300">{interestError}</p> : null}
                <p className="mt-4 text-[11px] leading-relaxed text-zinc-600">
                  We score submissions for bots (speed, spam patterns, fake fields). Empty notes still work — a real sentence ranks higher.
                </p>
              </div>

              <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
                <h2 className="text-2xl font-bold tracking-tight">Already invited?</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  Sign in with Google. After login you land on Flight Deck.
                </p>

                <div className="mt-7">
                  {!googleClientId ? (
                    <p className="rounded-xl border border-amber-700 bg-amber-950/60 p-4 text-sm text-amber-200">
                      Google login is not configured yet. Add GOOGLE_OAUTH_CLIENT_ID (or NEXT_PUBLIC_GOOGLE_CLIENT_ID) in Cloud Run, then redeploy or refresh this page.
                    </p>
                  ) : (
                    <div className="flex justify-center">
                      <div id="google-signin-button" />
                    </div>
                  )}
                  {error && (
                    <p className="mt-4 rounded-xl border border-red-800 bg-red-950/60 p-3 text-sm text-red-200">{error}</p>
                  )}
                </div>

                <div className="mt-6 flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-600">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 1l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V4l7-3z" clipRule="evenodd" />
                  </svg>
                  Private · invite only · no shared passwords
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/70"
              >
                <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${feature.chip}`}>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 13h2v4H3v-4zm4-6h2v10H7V7zm4 3h2v7h-2v-7zm4-6h2v13h-2V4z" />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-zinc-100">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{feature.desc}</p>
              </div>
            ))}
          </section>

          <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
            {dreamTreeHost
              ? 'Dream Tree Stocks — private research tool. For informational purposes only; not investment advice.'
              : 'OnePersonEmpire Scanner — private research tool. For informational purposes only; not investment advice.'}
          </footer>
        </div>
      </main>
    );
  }

  if (!loading && user && !stayOnSystems) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-16 text-center text-zinc-300">
        <p className="text-lg">Opening Flight Deck…</p>
        <Link href="/scanner/cockpit" className="mt-4 inline-block text-amber-300 underline">
          Continue
        </Link>
      </main>
    );
  }

  return (
    <main className={`min-h-screen bg-zinc-950 px-6 text-zinc-100 ${previewPolish ? 'py-8' : 'py-10'}`}>
      <div className="mx-auto max-w-7xl">
        <div
          className={
            previewPolish
              ? 'mb-6 overflow-hidden rounded-2xl border border-emerald-800/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 shadow-lg shadow-emerald-950/30'
              : 'mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 shadow-2xl'
          }
        >
          {previewPolish ? <div className="h-1 bg-gradient-to-r from-transparent via-emerald-500/80 to-transparent" /> : null}
          <div className={previewPolish ? 'p-6' : ''}>
          {previewPolish ? (
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
              <div className="flex items-center justify-center gap-3 md:justify-start">
                <DreamTreeHeaderLogo className="h-12 w-[4.25rem]" />
                <div className="text-center md:text-left">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-emerald-400">
                    Private scanner
                  </p>
                  <h1 className="text-2xl font-bold tracking-tight text-zinc-100 md:text-3xl">
                    Dream Tree Stocks
                  </h1>
                </div>
              </div>
              <div className="text-center">
                {data?.generatedAt ? (
                  <p className="text-sm text-zinc-400">
                    Last updated
                    <span className="mt-1 block font-semibold text-emerald-300">
                      {formatDashboardDate(data.generatedAt)}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-center gap-2 md:justify-end">
                <Link
                  href="/scanner/charts"
                  className="rounded-full border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-300 hover:border-amber-500 hover:text-amber-200"
                >
                  Charts
                </Link>
                <Link
                  href="/scanner/requests"
                  className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-300 hover:border-emerald-500 hover:text-emerald-200"
                >
                  Request a scan
                </Link>
                {user ? (
                  <button
                    onClick={logout}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-zinc-500"
                  >
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">Private scanner</p>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h1 className="text-4xl font-bold tracking-tight">OnePersonEmpire Stock Scanner</h1>
                {data?.generatedAt ? (
                  <p className="mt-2 text-sm text-zinc-400">
                    Dashboard last updated: <span className="font-semibold text-emerald-300">{data.generatedAt}</span>
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/scanner/charts"
                    className="rounded-full border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-300 hover:border-amber-500 hover:text-amber-200"
                  >
                    Charts
                  </Link>
                  <Link
                    href="/scanner/requests"
                    className="rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-300 hover:border-emerald-500 hover:text-emerald-200"
                  >
                    Request a scan
                  </Link>
                </div>
              </div>
            </>
          )}
          </div>
        </div>

        {user && data?.liveScanOk === false ? (
          <section className="mb-6 rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-amber-100">
            Saved scan fallback — live refresh did not run. Picks may be stale.
            {data.liveScanError ? <span className="mt-1 block text-sm text-amber-200/90">{data.liveScanError}</span> : null}
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">Checking session...</section>
        ) : !user ? null : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <section
              className={
                previewPolish
                  ? 'rounded-2xl border border-emerald-900/25 bg-zinc-900/90 p-6 shadow-inner shadow-emerald-950/10'
                  : 'rounded-2xl border border-zinc-800 bg-zinc-900 p-6'
              }
            >
              {!previewPolish ? (
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">Scanner Dashboard</h2>
                    <p className="text-sm text-zinc-400">Logged in as {user.email}</p>
                  </div>
                  <button
                    onClick={logout}
                    className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-zinc-500"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}

              {previewPolish ? (
                <>
                  {regimeSignalsPanel ? <div className="mb-6">{regimeSignalsPanel}</div> : null}
                  {systemsForSelect.length ? (
                    <label className="mb-6 block">
                      <span className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-zinc-300">
                        <span>Scanner</span>
                        <Link
                          href="/scanner/cockpit"
                          className="rounded-full border border-amber-600/70 bg-amber-950/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:border-amber-400 hover:text-amber-100"
                        >
                          Flight Deck →
                        </Link>
                      </span>
                      <select
                        value={selectedSystem?.id || selectedSystemId}
                        onChange={(event) => onScannerSelect(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                      >
                        <option value="__flight-deck__">★ Flight Deck · meta-agent</option>
                        {systemsForSelect.map((system) => (
                          <option key={system.id} value={system.id}>
                            {system.label}
                            {formatAgentRankSuffix(agentRanks[system.id])}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}

              {!previewPolish && scaleOperatorPanel ? <div className="mb-6">{scaleOperatorPanel}</div> : null}

              {!previewPolish && forwardPaperPanel ? <div className="mb-6">{forwardPaperPanel}</div> : null}

              {selectedSystem ? (
                <div className="space-y-5">
                  {!previewPolish ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        title="Based on IBD's Power Trend methodology (21-day EMA / 50-day MA trend conditions). Not affiliated with Investor's Business Daily."
                        className={`rounded-full border px-3 py-1 text-sm font-semibold ${
                          powerOn
                            ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                            : 'border-red-800 bg-red-950 text-red-200'
                        }`}
                      >
                        {powerLabel}
                      </span>
                      <span className="text-sm text-zinc-400">
                        {selectedSystem.isLive ? 'Live scan' : 'Saved scan'} · as of{' '}
                        {selectedSystem.asOf || selectedSystem.date || 'n/a'}
                      </span>
                      {nextLean && nextMeeting ? (
                        <Link
                          href="/scanner/fedwatch"
                          title="Market-implied odds for the next FOMC meeting"
                          className={`rounded-full border px-3 py-1 text-sm font-semibold transition hover:brightness-110 ${
                            nextLean.tone === 'hike'
                              ? 'border-amber-700 bg-amber-950 text-amber-200'
                              : nextLean.tone === 'cut'
                                ? 'border-emerald-700 bg-emerald-950 text-emerald-300'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                          }`}
                        >
                          {nextLean.tone === 'hike' ? '↑ ' : nextLean.tone === 'cut' ? '↓ ' : ''}
                          {nextLean.direction === 'hold'
                            ? `Fed hold ${nextLean.prob.toFixed(0)}%`
                            : `Upcoming ${nextLean.label.toLowerCase()} ${nextLean.prob.toFixed(0)}%`}
                          <span className="ml-1 font-normal text-zinc-400">· {formatMeetingDate(nextMeeting.meetingDate)}</span>
                        </Link>
                      ) : null}
                    </div>
                  ) : null}

                  {!previewPolish ? regimeSignalsPanel : null}

                  {!previewPolish ? (
                    <label className="block">
                      <span className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-zinc-300">
                        <span>Scanner</span>
                        <Link
                          href="/scanner/cockpit"
                          className="rounded-full border border-amber-600/70 bg-amber-950/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200 hover:border-amber-400 hover:text-amber-100"
                        >
                          Flight Deck →
                        </Link>
                      </span>
                      <select
                        value={selectedSystem.id}
                        onChange={(event) => onScannerSelect(event.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100"
                      >
                        <option value="__flight-deck__">★ Flight Deck · meta-agent</option>
                        {systemsForSelect.map((system) => (
                          <option key={system.id} value={system.id}>
                            {system.label}
                            {formatAgentRankSuffix(agentRanks[system.id])}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <div className={`grid gap-3 ${previewPolish ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-4'}`}>
                    {Object.entries(selectedSystem.stats || {}).map(([label, value]) => {
                      const isHoldReturn = label === 'Hold return';
                      const holdTone = isHoldReturn ? holdReturnToneClass(selectedSystem.holdReturnPct) : 'text-zinc-200';
                      return (
                      <div
                        key={label}
                        className={`rounded-xl border border-zinc-800 bg-zinc-950 p-4 ${
                          previewPolish ? 'flex min-h-[5.5rem] flex-col justify-center text-center' : ''
                        } ${isHoldReturn ? 'border-amber-800/50 bg-amber-950/20' : ''}`}
                      >
                        <div className={`text-2xl font-bold ${holdTone}`}>{value}</div>
                        <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
                      </div>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                    <h3 className="text-lg font-semibold">{selectedSystem.label}</h3>
                    {selectedSystem.isHoldVariant || selectedSystem.usesLedgerHoldings ? (
                      <p className="mt-2 inline-flex rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
                        {selectedSystem.usesLedgerHoldings ? 'Live ledger hold' : 'Scheduled hold basket'}
                        {selectedSystem.holdSince ? ` · since ${formatDashboardDate(selectedSystem.holdSince)}` : ''}
                        {selectedSystem.holdCadenceLabel ? ` · ${selectedSystem.holdCadenceLabel}` : ''}
                        {selectedSystem.holdReturnPct != null
                          ? ` · ${selectedSystem.holdReturnPct > 0 ? '+' : ''}${selectedSystem.holdReturnPct.toFixed(2)}%`
                          : ''}
                      </p>
                    ) : null}
                    <p className="mt-2 text-zinc-300">{selectedSystem.note}</p>
                    <p className="mt-2 text-sm text-zinc-500">
                      {selectedSystem.isHoldVariant || selectedSystem.usesLedgerHoldings
                        ? `Held since: ${formatDashboardDate(selectedSystem.holdSince || selectedSystem.date) || 'n/a'}`
                        : `Saved rebalance date: ${selectedSystem.date || 'n/a'}`}
                    </p>
                    {selectedSystem.overlayModule?.line ? (
                      <p className="mt-3 rounded-lg border border-sky-800/40 bg-sky-950/20 p-3 text-sm text-sky-100/90">
                        {selectedSystem.overlayModule.line}
                      </p>
                    ) : null}
                    {!!selectedSystem.method?.length && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">How it works</h4>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-300">
                          {selectedSystem.method.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 lg:col-span-2">
                      <h3 className="mb-1 text-lg font-semibold">
                        {isBearScanner
                          ? 'Defense Picks'
                          : selectedSystem.isHoldVariant || selectedSystem.usesLedgerHoldings
                            ? 'Held Stocks'
                            : 'Top Names'}
                      </h3>
                      <p className="mb-3 text-xs text-zinc-600">
                        {isBearScanner
                          ? 'Bottom 10 negative momentum per universe. Simulated-short radar — not broker shorts.'
                          : selectedSystem.dailyUniverses?.length
                            ? 'Daily raw top 10 per universe (positive momentum). Chips: animal, runway, risk, flow, earnings.'
                            : 'Chips show animal, runway, music-stops risk, flow, and upcoming earnings when on the calendar.'}
                      </p>
                      {isBearScanner && bearUniverseGroups?.length ? (
                        <div className="space-y-5">
                          <div className="flex flex-wrap items-baseline justify-end gap-2">
                            <Link
                              href="/scanner/raw-bear"
                              className="text-xs font-semibold text-red-300 hover:text-red-200"
                            >
                              Forward test →
                            </Link>
                          </div>
                          {bearUniverseGroups.map((group) => (
                            <div
                              key={`bear-${group.key}`}
                              className="rounded-lg border border-red-900/30 bg-red-950/20 p-4"
                            >
                              <p className="text-sm font-semibold text-red-200">
                                {group.label}:{' '}
                                <span className="font-normal text-zinc-300">
                                  {(group.top || []).length ? (group.top || []).join(', ') : 'No picks'}
                                </span>
                              </p>
                              <p className="mt-1 text-xs text-zinc-600">
                                {group.negativeCount ?? group.rows?.length ?? 0} negative ·{' '}
                                {group.eligibleCount ?? '—'} eligible
                              </p>
                              <div className="mt-3 space-y-2">
                                {(group.rows?.length ? group.rows.map((row) => row.ticker) : group.top || []).map(
                                  (ticker, index) => (
                                    <PickNameRow
                                      key={`bear-only-${group.key}-${ticker}-${index}`}
                                      ticker={ticker}
                                      index={index}
                                      ewLabel={ewLabels[ticker]}
                                      context={pickContextByTicker[ticker.toUpperCase()]}
                                      priorityLabel="Weak momentum"
                                    />
                                  ),
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : selectedSystem.dailyUniverses?.length ? (
                        <div className="space-y-5">
                          {selectedSystem.dailyUniverses.map((group) => (
                            <div key={group.key} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                              <p className="text-sm font-semibold text-sky-200">
                                {group.label}:{' '}
                                <span className="font-normal text-zinc-200">
                                  {(group.top || []).length ? (group.top || []).join(', ') : 'No picks'}
                                </span>
                              </p>
                              <div className="mt-3 space-y-2">
                                {(group.top || []).map((ticker, index) => (
                                  <PickNameRow
                                    key={`${group.key}-${ticker}-${index}`}
                                    ticker={ticker}
                                    index={index}
                                    ewLabel={ewLabels[ticker]}
                                    context={pickContextByTicker[ticker.toUpperCase()]}
                                    highlight={index < 3}
                                    priorityLabel={index < 3 ? 'Highest priority' : 'Portfolio name'}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(selectedSystem.top || []).map((ticker, index) => {
                            const holdRet = selectedSystem.holdTickerReturns?.[ticker.toUpperCase()];
                            const holdLabel =
                              holdRet != null
                                ? `${holdRet > 0 ? '+' : ''}${holdRet.toFixed(1)}% since hold`
                                : undefined;
                            return (
                            <PickNameRow
                              key={`${ticker}-${index}`}
                              ticker={ticker}
                              index={index}
                              ewLabel={ewLabels[ticker]}
                              context={pickContextByTicker[ticker.toUpperCase()]}
                              highlight={index < 3}
                              priorityLabel={
                                holdLabel ||
                                (index < 3 ? 'Highest priority' : 'Portfolio name')
                              }
                            />
                            );
                          })}
                        </div>
                      )}

                      {bearUniverseGroups?.length && !isBearScanner ? (
                        <div className="mt-8 border-t border-red-900/40 pt-6">
                          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                              <h4 className="text-base font-semibold text-red-200">Defense — negative momentum</h4>
                              <p className="mt-1 text-xs text-zinc-500">
                                Simulated-short radar only (not broker shorts). Profit in forward test when names fall.
                              </p>
                            </div>
                            <Link
                              href="/scanner/raw-bear"
                              className="text-xs font-semibold text-red-300 hover:text-red-200"
                            >
                              Forward test →
                            </Link>
                          </div>
                          <div className="space-y-5">
                            {bearUniverseGroups.map((group) => (
                              <div
                                key={`bear-${group.key}`}
                                className="rounded-lg border border-red-900/30 bg-red-950/20 p-4"
                              >
                                <p className="text-sm font-semibold text-red-200">
                                  {group.label}:{' '}
                                  <span className="font-normal text-zinc-300">
                                    {(group.top || []).length ? (group.top || []).join(', ') : 'No picks'}
                                  </span>
                                </p>
                                <p className="mt-1 text-xs text-zinc-600">
                                  {group.negativeCount ?? group.rows?.length ?? 0} negative ·{' '}
                                  {group.eligibleCount ?? '—'} eligible
                                </p>
                                <div className="mt-3 space-y-2">
                                  {(group.rows?.length ? group.rows.map((row) => row.ticker) : group.top || []).map(
                                    (ticker, index) => (
                                      <PickNameRow
                                        key={`bear-${group.key}-${ticker}-${index}`}
                                        ticker={ticker}
                                        index={index}
                                        ewLabel={ewLabels[ticker]}
                                        context={pickContextByTicker[ticker.toUpperCase()]}
                                        priorityLabel="Weak momentum"
                                      />
                                    ),
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {!!selectedSystem.watch?.length && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                        <h3 className="mb-1 text-lg font-semibold">Weekly Basket If PowerTrend ON</h3>
                        <p className="mb-3 text-sm text-zinc-500">Weekly date: {selectedSystem.watchDate || 'n/a'}</p>
                        <div className="space-y-2">
                          {selectedSystem.watch.map((ticker, index) => (
                            <PickNameRow
                              key={`${ticker}-${index}`}
                              ticker={ticker}
                              index={index}
                              ewLabel={ewLabels[ticker]}
                              context={pickContextByTicker[ticker.toUpperCase()]}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                  <h3 className="text-lg font-semibold">Scanner data</h3>
                  <p className="mt-2 text-zinc-300">
                    {data?.message || 'Scanner data will appear here after the stock project exports web results.'}
                  </p>
                  <p className="mt-4 text-sm text-zinc-500">
                    Access level: <span className="font-semibold text-emerald-300">{user.role}</span>
                  </p>
                </div>
              )}
            </section>

            <aside
              className={
                previewPolish
                  ? 'rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-6'
                  : 'rounded-2xl border border-zinc-800 bg-zinc-900 p-6'
              }
            >
              {!previewPolish ? (
                <>
                  <h2 className="text-xl font-semibold">Access</h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    This page is tied to the signed-in Google account, not a shared password.
                  </p>
                  <a
                    href="/scanner/requests"
                    className="mt-5 inline-flex rounded-full border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-300 hover:border-emerald-500 hover:text-emerald-200"
                  >
                    Request a scan
                  </a>
                </>
              ) : null}
              <div
                className={
                  previewPolish
                    ? 'space-y-2 text-sm'
                    : 'mt-5 space-y-2 border-t border-zinc-800 pt-5 text-sm'
                }
              >
                {previewPolish ? (
                  <div className="space-y-5">
                    {SIDEBAR_NAV_GROUPS.map((group) => {
                      const items = group.items.filter(
                        (item) => !item.developerOnly || user.role === 'developer',
                      );
                      if (!items.length) return null;
                      return (
                        <div key={group.id} className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                            {group.label}
                          </p>
                          <div className="space-y-2">
                            {items.map((item) => (
                              <Link key={item.href} href={item.href} className={sidebarLinkClass(item.tone)}>
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-zinc-300">Separate tools</p>
                    <Link href="/scanner/cockpit" className="block text-amber-300 hover:text-amber-200">
                      Flight Deck
                    </Link>
                    <Link href="/scanner/charts" className="block text-amber-300 hover:text-amber-200">
                      Charts
                    </Link>
                    <Link href="/scanner/options-institutions" className="block text-amber-300 hover:text-amber-200">
                      Options/institutions
                    </Link>
                    <Link href="/scanner/forest" className="block text-amber-300 hover:text-amber-200">
                      Forest
                    </Link>
                    <Link href="/scanner/trees" className="block text-amber-300 hover:text-amber-200">
                      Market trees
                    </Link>
                    <Link href="/scanner/gallery" className="block text-amber-300 hover:text-amber-200">
                      Price as art
                    </Link>
                    <Link href="/scanner/top100" className="block text-emerald-300 hover:text-emerald-200">
                      Top 100 stocks
                    </Link>
                    <Link href="/scanner/top-ten" className="block text-emerald-300 hover:text-emerald-200">
                      Top Ten
                    </Link>
                    <Link href="/scanner/journal" className="block text-emerald-300 hover:text-emerald-200">
                      Trade journal
                    </Link>
                    <Link href="/scanner/daytrade" className="block text-amber-300 hover:text-amber-200">
                      Day trade (3× ETFs)
                    </Link>
                    <Link href="/scanner/valuations" className="block text-emerald-300 hover:text-emerald-200">
                      Valuations
                    </Link>
                    {user.role === 'developer' ? (
                      <Link href="/scanner/catalysts" className="block text-emerald-300 hover:text-emerald-200">
                        Catalysts
                      </Link>
                    ) : null}
                    <Link href="/scanner/instructions" className="block text-emerald-300 hover:text-emerald-200">
                      Instructions
                    </Link>
                    <Link href="/scanner/fundamentals" className="block text-emerald-300 hover:text-emerald-200">
                      Proprietary fundamentals
                    </Link>
                    <Link href="/scanner/calendar" className="block text-emerald-300 hover:text-emerald-200">
                      Earnings calendar
                    </Link>
                    <Link href="/scanner/macro" className="block text-emerald-300 hover:text-emerald-200">
                      Macro calendar
                    </Link>
                    <Link href="/scanner/fedwatch" className="block text-emerald-300 hover:text-emerald-200">
                      Fed rate odds
                    </Link>
                    <Link href="/scanner/monitor" className="block text-emerald-300 hover:text-emerald-200">
                      Adaptive monitor
                    </Link>
                    <Link href="/scanner/agents" className="block text-emerald-300 hover:text-emerald-200">
                      Agent tournament
                    </Link>
                    <Link href="/scanner/cot" className="block text-emerald-300 hover:text-emerald-200">
                      COT report
                    </Link>
                    <Link href="/scanner/probabilities" className="block text-emerald-300 hover:text-emerald-200">
                      Probabilities
                    </Link>
                  </>
                )}
              </div>
              {user.role === 'developer' ? (
                <div className="mt-5 rounded-xl border border-emerald-800 bg-emerald-950/40 p-4">
                  <h3 className="font-semibold text-emerald-200">Developer tools</h3>
                  <p className="mt-2 text-sm text-emerald-100">{developerMessage || 'Developer access confirmed.'}</p>
                  {downloadUrl ? (
                    <a
                      href={downloadUrl}
                      className="mt-4 inline-flex rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-emerald-400"
                    >
                      Download scanner zip{scannerFileCount ? ` (${scannerFileCount} scanners)` : ''}
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="font-semibold">Viewer account</h3>
                  <p className="mt-2 text-sm text-zinc-400">This account can view scanner results but cannot download code.</p>
                </div>
              )}
              <PickContextLegend />
            </aside>
          </div>
        )}

        {previewPolish && user && !loading && (forwardPaperPanel || scaleOperatorPanel) ? (
          <div className="mt-6 space-y-6">
            {forwardPaperPanel}
            {scaleOperatorPanel}
          </div>
        ) : null}
      </div>
    </main>
  );
}
