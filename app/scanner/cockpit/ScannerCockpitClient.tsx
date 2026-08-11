'use client';

import Link from 'next/link';
import { Rajdhani, Share_Tech_Mono } from 'next/font/google';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { CockpitCandidate, CockpitGauge, CockpitPayload } from '@/lib/scanner-cockpit';
import type { CockpitForwardPayload } from '@/lib/scanner-cockpit-forward';
import type { ScannerAlertPrefs } from '@/lib/scanner-alert-prefs-types';
import { deskQuoteForDate } from '@/lib/scanner-desk-quotes';
import ScannerExtrasNav from '../_extras/ScannerExtrasNav';

const cockpitSans = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cockpit-sans',
});

const cockpitMono = Share_Tech_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-cockpit-mono',
});

type ScannerUser = { email: string; role: 'viewer' | 'developer' };

const fetchInit: RequestInit = { cache: 'no-store', credentials: 'include' };

function EarningsBadge({
  badge,
  threeDay,
}: {
  badge?: string | null;
  threeDay?: number | null;
}) {
  if (badge !== 'pass' && badge !== 'fail') return null;
  const title =
    threeDay != null && !Number.isNaN(threeDay)
      ? `Last day+3 ${threeDay >= 0 ? '+' : ''}${threeDay.toFixed(1)}%`
      : badge === 'pass'
        ? 'Day+3 ≥ +10%'
        : 'Day+3 ≤ −10%';
  return (
    <span
      title={title}
      className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        badge === 'pass'
          ? 'border-sky-600/70 bg-sky-950/70 text-sky-200'
          : 'border-red-700/70 bg-red-950/60 text-red-200'
      }`}
    >
      {badge === 'pass' ? 'PASS+' : 'FAIL−'}
    </span>
  );
}

function GaugeDial({ gauge }: { gauge: CockpitGauge }) {
  const angle = -120 + (Math.max(0, Math.min(100, gauge.value)) / 100) * 240;
  const tone =
    gauge.tone === 'hot'
      ? '#f59e0b'
      : gauge.tone === 'ok'
        ? '#34d399'
        : gauge.tone === 'warn'
          ? '#fbbf24'
          : gauge.tone === 'cold'
            ? '#f87171'
            : '#94a3b8';

  return (
    <div className="gauge-tile flex flex-col items-center rounded-2xl border border-amber-900/40 bg-zinc-950/80 p-3 shadow-inner">
      <div className="relative h-28 w-28">
        <svg viewBox="0 0 120 120" className="h-full w-full">
          <circle cx="60" cy="60" r="48" fill="#0a0a0a" stroke="#3f3f46" strokeWidth="6" />
          <path
            d="M20 78 A48 48 0 1 1 100 78"
            fill="none"
            stroke="#27272a"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M20 78 A48 48 0 1 1 100 78"
            fill="none"
            stroke={tone}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(gauge.value / 100) * 226} 226`}
            opacity="0.9"
          />
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="22"
            stroke={tone}
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${angle} 60 60)`}
          />
          <circle cx="60" cy="60" r="5" fill="#fbbf24" />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-3">
          <span className="font-mono text-sm font-bold" style={{ color: tone }}>
            {gauge.display}
          </span>
        </div>
      </div>
      <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">
        {gauge.label}
      </p>
      {gauge.detail ? <p className="mt-0.5 max-w-[9rem] text-center text-[10px] text-zinc-500">{gauge.detail}</p> : null}
    </div>
  );
}

function Knob({
  label,
  value,
  min,
  max,
  onChange,
  unit = '',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const rot = -140 + (pct / 100) * 280;
  return (
    <label className="flex flex-col items-center gap-2 rounded-2xl border border-zinc-700/80 bg-gradient-to-b from-zinc-800 to-zinc-950 p-4">
      <div className="relative h-20 w-20 rounded-full border-4 border-zinc-600 bg-[radial-gradient(circle_at_30%_30%,#52525b,#18181b)] shadow-[inset_0_0_20px_#000]">
        <div
          className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 origin-bottom rounded-full bg-amber-400 shadow"
          style={{ transform: `translate(-50%, -100%) rotate(${rot}deg)` }}
        />
        <div className="absolute inset-0 flex items-center justify-center pt-6">
          <span className="font-mono text-xs text-amber-100">
            {value}
            {unit}
          </span>
        </div>
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </label>
  );
}

function FlipSwitch({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-left"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</span>
      <span
        className={`relative h-6 w-12 rounded-full transition ${on ? 'bg-emerald-600' : 'bg-zinc-700'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            on ? 'left-6' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function applyKnobs(
  bookNames: CockpitCandidate[],
  opts: {
    aggression: number;
    diversification: number;
    thrustBoost: number;
    gravyOn: boolean;
    breakerForce: boolean;
    powerTrendOn: boolean;
    baseGrossPct: number;
    gravy?: { ticker: string; weightPct: number; note: string } | null;
  },
) {
  const maxNames = Math.round(8 + (opts.diversification / 100) * 10);
  let names = bookNames.slice(0, Math.max(1, maxNames));

  // Knobs set *target* deployed % (not an accidental shrink of already-cut weights).
  // Aggression + thrust move around the regime/PowerTrend base; breaker floors risk.
  let targetGross = opts.baseGrossPct;
  targetGross += (opts.aggression - 50) * 0.35;
  targetGross += (opts.thrustBoost - 50) * 0.25;
  // PT OFF: still allow full deploy via knobs (constitution = stay invested; PT only shifts the *default*)
  if (opts.breakerForce) targetGross = 0;
  targetGross = Math.max(0, Math.min(100, Math.round(targetGross)));

  const scoreSum = names.reduce((s, n) => s + Math.max(n.score, 1), 0) || 1;
  names = names.map((n) => ({
    ...n,
    weightPct: Math.round((Math.max(n.score, 1) / scoreSum) * targetGross * 10) / 10,
  }));

  // Fix rounding drift so core weights sum to targetGross
  const coreSum = names.reduce((s, n) => s + n.weightPct, 0);
  if (names.length && Math.abs(coreSum - targetGross) >= 0.1) {
    names[0] = {
      ...names[0],
      weightPct: Math.round((names[0].weightPct + (targetGross - coreSum)) * 10) / 10,
    };
  }

  const gravy =
    opts.gravyOn && opts.gravy && opts.powerTrendOn && !opts.breakerForce && targetGross >= 70
      ? {
          ...opts.gravy,
          weightPct: Math.round((8 + opts.aggression / 12) * 10) / 10,
        }
      : null;

  const gravyPct = gravy?.weightPct ?? 0;
  // Gravy is “extra punch” on top of core; cash is what’s left of 100% after core.
  const cash = Math.max(0, Math.round((100 - targetGross) * 10) / 10);

  return {
    names,
    gross: targetGross,
    cash,
    gravy,
    gravyPct,
  };
}

export default function ScannerCockpitClient() {
  const [user, setUser] = useState<ScannerUser | null>(null);
  const [data, setData] = useState<CockpitPayload | null>(null);
  const [forward, setForward] = useState<CockpitForwardPayload | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [aggression, setAggression] = useState(100);
  const [diversification, setDiversification] = useState(60);
  const [thrustBoost, setThrustBoost] = useState(100);
  const [gravyOn, setGravyOn] = useState(false);
  const [breakerForce, setBreakerForce] = useState(false);
  const [armed, setArmed] = useState(true);

  const [alertPrefs, setAlertPrefs] = useState<ScannerAlertPrefs | null>(null);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertEvents, setAlertEvents] = useState({
    ptFlip: true,
    bookChange: true,
    cashBrake: true,
    morningPostcard: false,
  });
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertError, setAlertError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const load = useCallback(async () => {
    const [sessionResponse, cockpitResponse, alertsResponse] = await Promise.all([
      fetch('/api/scanner/session', fetchInit),
      fetch('/api/scanner/cockpit', fetchInit),
      fetch('/api/scanner/alerts', fetchInit),
    ]);
    const sessionPayload = await sessionResponse.json();
    setUser(sessionPayload.user || null);
    const payload = await cockpitResponse.json();
    if (!cockpitResponse.ok) {
      setError(payload.error || 'Could not load cockpit.');
      return;
    }
    setError('');
    setData(payload.data || null);
    setForward(payload.forward || null);

    if (alertsResponse.ok) {
      const alertsPayload = await alertsResponse.json();
      const prefs = alertsPayload.prefs as ScannerAlertPrefs | undefined;
      if (prefs) {
        setAlertPrefs(prefs);
        setAlertEmail(prefs.email || sessionPayload.user?.email || '');
        setAlertEnabled(Boolean(prefs.enabled));
        setAlertEvents({
          ptFlip: prefs.events?.ptFlip !== false,
          bookChange: prefs.events?.bookChange !== false,
          cashBrake: prefs.events?.cashBrake !== false,
          morningPostcard: Boolean(prefs.events?.morningPostcard),
        });
        setShowOnboarding(!prefs.onboardingCompletedAt);
      } else if (sessionPayload.user?.email) {
        setAlertEmail(sessionPayload.user.email);
        setShowOnboarding(true);
      }
    } else if (sessionPayload.user?.email) {
      setAlertEmail(sessionPayload.user.email);
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load().finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const tuned = useMemo(() => {
    if (!data?.book) return null;
    return applyKnobs(data.book.names || [], {
      aggression,
      diversification,
      thrustBoost,
      gravyOn,
      breakerForce,
      powerTrendOn: data.instruments.powerTrendOn,
      baseGrossPct: Math.max(data.book.grossExposurePct, 100),
      gravy: data.book.gravy,
    });
  }, [data, aggression, diversification, thrustBoost, gravyOn, breakerForce]);

  const topTicker = tuned?.names?.[0]?.ticker || '';
  const nameCount = tuned?.names?.length ?? 0;
  const cashMode = Boolean(forward?.cashMode || breakerForce || (tuned && tuned.gross <= 0));
  const actionLine = useMemo(() => {
    if (!tuned) return 'Loading book…';
    if (cashMode) {
      return `Today: cash · breaker on · ${forward?.monthKey ? `rest of ${forward.monthKey}` : 'wait for next month'} · sit out`;
    }
    const lead = topTicker ? ` · #1 ${topTicker}` : '';
    return `Today: ${tuned.gross}% invested · ${nameCount} name${nameCount === 1 ? '' : 's'} · breaker clear${lead}`;
  }, [tuned, cashMode, topTicker, nameCount, forward?.monthKey]);

  const deskQuote = useMemo(() => deskQuoteForDate(), []);

  const saveAlerts = useCallback(async (opts?: { completeOnboarding?: boolean; enableAlerts?: boolean }) => {
    setAlertSaving(true);
    setAlertMessage('');
    setAlertError('');
    const enabled = opts?.enableAlerts != null ? opts.enableAlerts : alertEnabled;
    try {
      const response = await fetch('/api/scanner/alerts', {
        ...fetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: alertEmail,
          enabled,
          events: alertEvents,
          ...(opts?.completeOnboarding
            ? { onboardingCompletedAt: new Date().toISOString() }
            : alertPrefs?.onboardingCompletedAt
              ? { onboardingCompletedAt: alertPrefs.onboardingCompletedAt }
              : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setAlertError(payload.error || 'Could not save alerts.');
        return;
      }
      setAlertPrefs(payload.prefs || null);
      setAlertEnabled(Boolean(payload.prefs?.enabled));
      if (opts?.completeOnboarding) setShowOnboarding(false);
      setAlertMessage(payload.message || 'Saved.');
    } catch {
      setAlertError('Could not save alerts.');
    } finally {
      setAlertSaving(false);
    }
  }, [alertEmail, alertEnabled, alertEvents, alertPrefs?.onboardingCompletedAt]);

  const finishOnboarding = useCallback(
    async (turnOnAlerts: boolean) => {
      await saveAlerts({ completeOnboarding: true, enableAlerts: turnOnAlerts });
    },
    [saveAlerts],
  );

  const sendTestAlert = useCallback(async () => {
    setAlertSaving(true);
    setAlertMessage('');
    setAlertError('');
    try {
      const response = await fetch('/api/scanner/alerts/dispatch', {
        ...fetchInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = [payload.error, payload.step ? `(step: ${payload.step})` : '']
          .filter(Boolean)
          .join(' ');
        setAlertError(detail || 'Could not send test alert.');
        return;
      }
      const result = payload.result;
      if (result?.emailed) setAlertMessage(result.message || 'Test alert sent.');
      else setAlertError(result?.message || 'Test alert did not send.');
    } catch {
      setAlertError('Could not send test alert. Check network, then try again.');
    } finally {
      setAlertSaving(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="rounded-3xl border border-amber-900/40 bg-zinc-950/80 p-10 text-center text-amber-200/80">
        Spinning up instruments…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10">
        <p className="text-zinc-300">Sign in on the main scanner to enter the cockpit.</p>
        <Link href="/scanner" className="mt-4 inline-block text-amber-300 underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-red-900/50 bg-zinc-900 p-10">
        <p className="text-red-300">{error || data?.message || 'Cockpit offline.'}</p>
        <ScannerExtrasNav active="/scanner/cockpit" />
      </div>
    );
  }

  return (
    <div className={`${cockpitSans.variable} ${cockpitMono.variable} cockpit-shell space-y-6`}>
      <style jsx global>{`
        .cockpit-page {
          background:
            radial-gradient(ellipse at 20% 0%, rgba(245, 158, 11, 0.12), transparent 50%),
            radial-gradient(ellipse at 80% 10%, rgba(16, 185, 129, 0.1), transparent 45%),
            linear-gradient(180deg, #09090b 0%, #12100c 40%, #0a0a0a 100%);
        }
        .cockpit-shell {
          font-family: var(--font-cockpit-sans), 'Segoe UI', sans-serif;
        }
        .cockpit-shell .font-mono {
          font-family: var(--font-cockpit-mono), ui-monospace, monospace;
        }
        .hud-scan {
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(245, 158, 11, 0.03) 2px,
            rgba(245, 158, 11, 0.03) 4px
          );
        }
        .gauge-tile {
          animation: cockpitPulse 4s ease-in-out infinite;
        }
        @keyframes cockpitPulse {
          0%,
          100% {
            box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
          }
          50% {
            box-shadow: inset 0 0 20px rgba(245, 158, 11, 0.08);
          }
        }
      `}</style>

      <ScannerExtrasNav active="/scanner/cockpit" />

      <section className="rounded-2xl border border-amber-800/50 bg-amber-950/25 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-400">
          Day 1 · what this page is
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-50/90">
          This is <span className="font-semibold text-amber-100">today&apos;s book</span> — overlap, alerts, and what to
          do next. Theme leadership lives on{' '}
          <Link href="/scanner/leaders" className="font-semibold text-cyan-300 underline hover:text-cyan-200">
            Leaders
          </Link>
          ; the ranked warehouse is{' '}
          <Link href="/scanner?systems=1" className="font-semibold text-emerald-300 underline hover:text-emerald-200">
            System scanner
          </Link>
          .
        </p>
      </section>

      {showOnboarding ? (
        <section className="rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-950/50 to-zinc-950 p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-400">Welcome · first login</p>
          <h2 className="mt-2 text-2xl font-bold text-amber-50">This is your context desk</h2>
          <p className="mt-2 max-w-2xl text-sm text-amber-100/75">
            Flight Deck synthesizes feeds for satellites and awareness. Read{' '}
            <Link href="/scanner/core" className="font-semibold text-emerald-300 underline">
              Core
            </Link>{' '}
            for how to trade the main book. Turn on alerts for PowerTrend flips, book changes, or the cash brake.
          </p>
          <p className="mt-3 font-mono text-sm text-emerald-300">{actionLine}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={alertSaving}
              onClick={() => finishOnboarding(true)}
              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-60"
            >
              Got it · turn alerts on
            </button>
            <button
              type="button"
              disabled={alertSaving}
              onClick={() => finishOnboarding(false)}
              className="rounded-xl border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 hover:border-amber-500 disabled:opacity-60"
            >
              Got it · alerts later
            </button>
          </div>
        </section>
      ) : null}

      <header className="relative overflow-hidden rounded-3xl border border-amber-800/50 bg-zinc-950/90 p-6 sm:p-8 hud-scan">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-400">Satellite · flight deck</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-amber-50 sm:text-5xl">FLIGHT DECK</h1>
            <p className="mt-3 font-mono text-base font-semibold text-emerald-300 sm:text-lg">{actionLine}</p>
            <p className="mt-2 max-w-2xl text-sm text-amber-100/60">
              Context and satellite ideas from every scanner feed. Knobs change aggression — the Core desk plan stays
              the main book.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/scanner/core"
                className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 hover:border-emerald-400"
              >
                Core desk rules
              </Link>
              <Link
                href="/scanner?systems=1"
                className="rounded-full border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 hover:border-amber-500 hover:text-amber-100"
              >
                See systems
              </Link>
              {topTicker ? (
                <Link
                  href={`/scanner/charts?ticker=${encodeURIComponent(topTicker)}`}
                  className="rounded-full border border-amber-700/60 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100 hover:border-amber-400"
                >
                  Chart #1 {topTicker}
                </Link>
              ) : null}
              <Link
                href="/scanner/agents"
                className="rounded-full border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 hover:border-emerald-500 hover:text-emerald-100"
              >
                Agent scoreboard
              </Link>
              <Link
                href="/scanner/trees"
                className="rounded-full border border-emerald-700/60 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-100 hover:border-emerald-400"
              >
                Market trees
              </Link>
            </div>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3 sm:ml-auto">
            <div className="rounded-2xl border border-amber-700/40 bg-amber-950/25 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-amber-400">Desk note · day {deskQuote.day}</p>
              <p className="mt-2 text-sm leading-snug text-amber-50/95">&ldquo;{deskQuote.text}&rdquo;</p>
              <p className="mt-2 text-[11px] text-amber-200/55">{deskQuote.school}</p>
            </div>
            <div className="rounded-2xl border border-emerald-700/50 bg-emerald-950/40 px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-400">Master arm</p>
              <button
                type="button"
                onClick={() => setArmed((v) => !v)}
                className={`mt-1 rounded-full px-4 py-1.5 font-mono text-sm font-bold ${
                  armed ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-700 text-zinc-300'
                }`}
              >
                {armed ? 'ARMED' : 'SAFE'}
              </button>
              <p className="mt-2 font-mono text-[11px] text-zinc-500">
                as of {data.instruments.scannerAsOf || data.book.asOf || 'n/a'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-3xl border border-sky-900/50 bg-sky-950/20 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-sky-400">Alerts</p>
            <h2 className="mt-1 text-xl font-bold text-sky-50">Ping me when it matters</h2>
            <p className="mt-1 max-w-2xl text-sm text-sky-100/65">
              Emails you when PowerTrend flips, the book changes, or the cash brake arms — after each morning upload.
            </p>
          </div>
          <FlipSwitch label="Alerts on" on={alertEnabled} onToggle={() => setAlertEnabled((v) => !v)} />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[16rem] flex-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Email</span>
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-sky-500"
              placeholder="you@example.com"
            />
          </label>
          <button
            type="button"
            disabled={alertSaving}
            onClick={() => saveAlerts()}
            className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-bold text-zinc-950 hover:bg-sky-400 disabled:opacity-60"
          >
            {alertSaving ? 'Saving…' : 'Save alerts'}
          </button>
          <button
            type="button"
            disabled={alertSaving}
            onClick={sendTestAlert}
            className="rounded-xl border border-sky-700 bg-sky-950/50 px-4 py-2 text-sm font-semibold text-sky-100 hover:border-sky-400 disabled:opacity-60"
          >
            Send test
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-300">
          {(
            [
              ['ptFlip', 'PowerTrend flip'],
              ['bookChange', 'Book change'],
              ['cashBrake', 'Cash brake'],
              ['morningPostcard', 'Morning postcard (Garden)'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(alertEvents[key])}
                onChange={(e) => setAlertEvents((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="accent-sky-500"
              />
              {label}
            </label>
          ))}
        </div>
        {alertMessage ? <p className="mt-3 text-sm text-emerald-300">{alertMessage}</p> : null}
        {alertError ? <p className="mt-3 text-sm text-red-300">{alertError}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(data.gauges || []).map((gauge) => (
          <GaugeDial key={gauge.id} gauge={gauge} />
        ))}
      </section>

      <section className="rounded-3xl border border-emerald-800/50 bg-emerald-950/30 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
              Forward paper · default settings
            </p>
            <h2 className="mt-1 text-2xl font-bold text-emerald-50">Live scoreboard</h2>
            <p className="mt-1 max-w-2xl text-sm text-emerald-100/70">
              Trades at default: <span className="font-semibold text-emerald-200">100% invested</span>, equal weight.
              If the month is down more than 5%, goes to <span className="font-semibold text-amber-200">cash</span> until
              next month.
            </p>
          </div>
          {forward?.cashMode ? (
            <span className="rounded-full border border-amber-600 bg-amber-950 px-3 py-1 font-mono text-xs font-bold text-amber-200">
              CASH MODE · {forward.monthKey}
            </span>
          ) : (
            <span className="rounded-full border border-emerald-600 bg-emerald-950 px-3 py-1 font-mono text-xs font-bold text-emerald-200">
              100% INVESTED
            </span>
          )}
        </div>

        {forward?.connected ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Equity</p>
              <p className="font-mono text-xl text-amber-100">
                ${(forward.metrics?.equity ?? 100000).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Total return</p>
              <p
                className={`font-mono text-xl ${
                  (forward.metrics?.totalReturnPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {(forward.metrics?.totalReturnPct ?? 0) > 0 ? '+' : ''}
                {(forward.metrics?.totalReturnPct ?? 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Max DD</p>
              <p className="font-mono text-xl text-red-300">{(forward.metrics?.maxDrawdownPct ?? 0).toFixed(2)}%</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Month P&amp;L</p>
              <p
                className={`font-mono text-xl ${
                  (forward.monthReturnPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {(forward.monthReturnPct ?? 0) > 0 ? '+' : ''}
                {(forward.monthReturnPct ?? 0).toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3">
              <p className="text-[10px] uppercase tracking-wide text-zinc-500">Days / as of</p>
              <p className="font-mono text-xl text-zinc-200">
                {forward.metrics?.days ?? 0}
                <span className="ml-2 text-sm text-zinc-500">{forward.asOf}</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-200/80">
            {forward?.message || 'Data is refreshing. Check back shortly.'}
          </p>
        )}

        {forward?.holdings?.length ? (
          <p className="mt-4 font-mono text-sm text-zinc-300">
            Book: {forward.holdings.join(' · ')}
          </p>
        ) : forward?.connected && forward.cashMode ? (
          <p className="mt-4 text-sm text-amber-200">Breaker active — flat cash until next month.</p>
        ) : null}

        {forward?.trades?.length ? (
          <div className="mt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Recent events</p>
            <ul className="mt-2 space-y-1 text-xs text-zinc-400">
              {forward.trades.slice(-6).reverse().map((trade, i) => (
                <li key={`${trade.date}-${trade.type}-${i}`} className="font-mono">
                  {trade.date} · {trade.type}
                  {trade.reason ? ` · ${trade.reason}` : ''}
                  {trade.added?.length ? ` · +${trade.added.join(',')}` : ''}
                  {trade.removed?.length ? ` · −${trade.removed.join(',')}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="rounded-3xl border border-zinc-700/80 bg-zinc-950/90 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-amber-200">Mission book</h2>
            <span className="font-mono text-sm text-emerald-300">
              GROSS {tuned?.gross ?? data.book.grossExposurePct}% · CASH {tuned?.cash ?? data.book.cashPct}%
              {tuned?.gravy ? ` · GRAVY ${tuned.gravy.ticker} ${tuned.gravy.weightPct}%` : ''}
            </span>
          </div>

          {!armed ? (
            <p className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4 text-amber-100">
              SAFE mode — instruments live, no paper commitment. Flip master arm when ready.
            </p>
          ) : null}

          <div className="mt-3 space-y-2">
            {(tuned?.names || []).map((name, index) => (
              <div
                key={name.ticker}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5"
              >
                <span className="w-7 font-mono text-xs text-zinc-500">#{index + 1}</span>
                <Link
                  href={`/scanner/charts?ticker=${name.ticker}`}
                  className="w-16 font-mono text-lg font-bold text-amber-100 hover:text-amber-300"
                >
                  {name.ticker}
                </Link>
                <EarningsBadge badge={name.earningsBadge} threeDay={name.threeDayReactionPct} />
                <span className="font-mono text-emerald-300">{name.weightPct.toFixed(1)}%</span>
                {name.animal ? <span className="text-xs text-zinc-400">{name.animal}</span> : null}
                {name.glassBucket ? (
                  <span className="rounded-full border border-sky-800/60 px-2 py-0.5 text-[10px] text-sky-300">
                    room to fill
                  </span>
                ) : null}
                <p className="min-w-0 flex-1 text-xs text-zinc-500">{name.reasons.slice(0, 3).join(' · ')}</p>
              </div>
            ))}
            {!tuned?.names?.length ? (
              <p className="text-sm text-zinc-500">No eligible names after vetoes — check scans / pick context.</p>
            ) : null}
          </div>

          {tuned?.gravy ? (
            <div className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/30 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-amber-400">Gravy throttle</p>
              <p className="mt-1 font-mono text-xl text-amber-100">
                {tuned.gravy.ticker} · {tuned.gravy.weightPct}%
              </p>
              <p className="text-xs text-amber-200/70">{tuned.gravy.note}</p>
            </div>
          ) : null}

          {data.watchList?.length ? (
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Radar · next up</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.watchList.map((w) => (
                  <span
                    key={w.ticker}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1 font-mono text-sm text-zinc-300"
                  >
                    <Link
                      href={`/scanner/charts?ticker=${encodeURIComponent(w.ticker)}`}
                      className="hover:text-amber-200"
                    >
                      {w.ticker}
                    </Link>
                    <EarningsBadge badge={w.earningsBadge} threeDay={w.threeDayReactionPct} />
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-zinc-700 bg-zinc-950/90 p-5">
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-amber-200">Control panel</h2>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Knob label="Aggression" value={aggression} min={0} max={100} onChange={setAggression} />
              <Knob label="Diversity" value={diversification} min={0} max={100} onChange={setDiversification} />
              <Knob label="Thrust" value={thrustBoost} min={0} max={100} onChange={setThrustBoost} />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <FlipSwitch label="3× gravy" on={gravyOn} onToggle={() => setGravyOn((v) => !v)} />
              <FlipSwitch
                label="Circuit breaker"
                on={breakerForce}
                onToggle={() => setBreakerForce((v) => !v)}
              />
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              Knobs re-shape the live synthesis. They don&apos;t change your constitution rails — only how hard you lean
              in.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-700 bg-zinc-950/90 p-5">
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-amber-200">Leaderboard fuel</h2>
            <ul className="mt-3 space-y-2">
              {(data.instruments.topAgents || []).map((row) => (
                <li
                  key={`${row.systemId}-${row.rank}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">
                    <span className="font-mono text-zinc-500">#{row.rank}</span> {row.label}
                  </span>
                  <span
                    className={`font-mono ${row.returnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {row.returnPct > 0 ? '+' : ''}
                    {row.returnPct.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-emerald-900/40 bg-emerald-950/20 p-5">
            <h2 className="text-lg font-bold uppercase tracking-[0.2em] text-emerald-300">Brief</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-emerald-50/80">
              {(data.book.missionBrief || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">Constitution · playbook</h2>
        <p className="mt-3 max-w-4xl text-sm text-zinc-300">{data.constitutionLine}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data.playbook || []).map((item) => (
            <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">{item.title}</p>
              <p className="mt-1 text-xs text-zinc-400">{item.detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-zinc-600">
          Rails: ≤{data.rails.maxRiskPerTradePct}% risk/trade · month breaker {data.rails.monthlyCircuitBreakerPct}% ·
          stop {data.rails.preferredStop}
        </p>
      </section>
    </div>
  );
}
