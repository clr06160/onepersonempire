'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type NavAccent = 'garden' | 'leaders' | 'flight' | 'systems' | 'default';

type NavLink = {
  href: string;
  label: string;
  developerOnly?: boolean;
  accent?: NavAccent;
};

/**
 * Invited viewers: Garden path (Today, Forest, art, Leaders, Morning note, Charts).
 * Developers still get the full lab nav.
 */
const links: NavLink[] = [
  { href: '/scanner/garden', label: 'Today', accent: 'garden' },
  { href: '/scanner/forest', label: 'Forest', accent: 'garden' },
  { href: '/scanner/trees', label: 'Market trees', accent: 'garden' },
  { href: '/scanner/gallery', label: 'Price as art', accent: 'garden' },
  { href: '/scanner/leaders', label: 'Leaders', accent: 'leaders' },
  { href: '/scanner/desk-brief', label: 'Morning note', accent: 'flight' },
  { href: '/scanner/charts', label: 'Charts' },
  { href: '/scanner/cockpit', label: 'Flight Deck', accent: 'flight', developerOnly: true },
  { href: '/scanner/monthly-reports', label: 'Monthly reports', accent: 'leaders', developerOnly: true },
  { href: '/scanner?systems=1', label: 'System scanner', accent: 'systems', developerOnly: true },
  { href: '/scanner/instructions', label: 'Instructions', developerOnly: true },
  { href: '/scanner/core', label: 'Core', developerOnly: true },
  { href: '/scanner/chess-selection', label: 'Chess Selection', developerOnly: true },
  { href: '/scanner/mistakes', label: 'Mistakes', developerOnly: true },
  { href: '/scanner/desk-trainer', label: 'Risk Trainer', developerOnly: true },
  { href: '/scanner/options-institutions', label: 'Options/institutions', developerOnly: true },
  { href: '/scanner/top100', label: 'Top 100', developerOnly: true },
  { href: '/scanner/top-ten', label: 'Top Ten', developerOnly: true },
  { href: '/scanner/daytrade', label: 'Day trade', developerOnly: true },
  { href: '/scanner/journal', label: 'Trade journal', developerOnly: true },
  { href: '/scanner/valuations', label: 'Valuations', developerOnly: true },
  { href: '/scanner/earnings-glass', label: 'Earnings glass', developerOnly: true },
  { href: '/scanner/raw-bear', label: 'Raw bear', developerOnly: true },
  { href: '/scanner/catalysts', label: 'Catalysts', developerOnly: true },
  { href: '/scanner/cup-handle', label: 'Cup & handle', developerOnly: true },
  { href: '/scanner/news', label: 'News', developerOnly: true },
  { href: '/scanner/monitor', label: 'Adaptive monitor', developerOnly: true },
  { href: '/scanner/agents', label: 'Agent tournament', developerOnly: true },
  { href: '/scanner/fundamentals', label: 'Proprietary fundamentals', developerOnly: true },
  { href: '/scanner/calendar', label: 'Earnings calendar', developerOnly: true },
  { href: '/scanner/macro', label: 'Macro calendar', developerOnly: true },
  { href: '/scanner/fedwatch', label: 'Fed rate odds', developerOnly: true },
  { href: '/scanner/cot', label: 'COT report', developerOnly: true },
  { href: '/scanner/probabilities', label: 'Probabilities', developerOnly: true },
  { href: '/scanner/elliott-wave', label: 'Elliott Wave', developerOnly: true },
  { href: '/scanner/first-pullbacks', label: 'First Pullbacks', developerOnly: true },
  { href: '/scanner/tops-bottoms', label: 'Tops & bottoms', developerOnly: true },
  { href: '/scanner/ipo-short', label: 'Shorting IPOs', developerOnly: true },
  { href: '/scanner/bracket', label: 'Horizontal Bracket', developerOnly: true },
  { href: '/scanner/requests', label: 'Request a scan', developerOnly: true },
  { href: '/scanner/waitlist', label: 'Interest waitlist', developerOnly: true },
  { href: '/scanner/users', label: 'Users', developerOnly: true },
];

function linkClass(accent: NavAccent | undefined, isActive: boolean, isLight: boolean) {
  const a = accent || 'default';

  if (isActive) {
    if (a === 'garden') {
      return isLight
        ? 'border-lime-700 bg-lime-700 text-white shadow-sm'
        : 'border-lime-400 bg-lime-950 text-lime-100';
    }
    if (a === 'leaders') {
      return isLight
        ? 'border-cyan-700 bg-cyan-700 text-white shadow-sm'
        : 'border-cyan-400 bg-cyan-950 text-cyan-100';
    }
    if (a === 'flight') {
      return isLight
        ? 'border-amber-700 bg-amber-600 text-white shadow-sm'
        : 'border-amber-400 bg-amber-950 text-amber-100';
    }
    if (a === 'systems') {
      return isLight
        ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
        : 'border-emerald-400 bg-emerald-950 text-emerald-100';
    }
    return isLight
      ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
      : 'border-emerald-500 bg-emerald-950 text-emerald-100';
  }

  if (a === 'garden') {
    return isLight
      ? 'border-lime-600 bg-lime-50 text-lime-950 shadow-sm hover:border-lime-700 hover:bg-lime-100'
      : 'border-lime-700/70 bg-lime-950/40 text-lime-200 hover:border-lime-400 hover:bg-lime-950';
  }
  if (a === 'leaders') {
    return isLight
      ? 'border-cyan-600 bg-cyan-50 text-cyan-950 shadow-sm hover:border-cyan-700 hover:bg-cyan-100'
      : 'border-cyan-600 bg-cyan-950/50 text-cyan-200 hover:border-cyan-400 hover:bg-cyan-950';
  }
  if (a === 'flight') {
    return isLight
      ? 'border-amber-600 bg-amber-50 text-amber-950 shadow-sm hover:border-amber-700 hover:bg-amber-100'
      : 'border-amber-600 bg-amber-950/45 text-amber-200 hover:border-amber-400 hover:bg-amber-950';
  }
  if (a === 'systems') {
    return isLight
      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm hover:border-emerald-700 hover:bg-emerald-100'
      : 'border-emerald-600 bg-emerald-950/45 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-950';
  }

  return isLight
    ? 'border-zinc-500 bg-white text-zinc-900 shadow-sm hover:border-zinc-700 hover:bg-zinc-50'
    : 'border-zinc-500 bg-zinc-900 text-zinc-100 hover:border-zinc-300 hover:bg-zinc-800';
}

type ScannerExtrasNavProps = {
  active: string;
  /** Charts use a light page background; other scanner pages use dark. */
  theme?: 'dark' | 'light';
};

export default function ScannerExtrasNav({ active, theme = 'dark' }: ScannerExtrasNavProps) {
  const isLight = theme === 'light';
  const [isDeveloper, setIsDeveloper] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/scanner/session', { cache: 'no-store', credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!cancelled) setIsDeveloper(payload?.user?.role === 'developer');
      })
      .catch(() => {
        if (!cancelled) setIsDeveloper(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleLinks = links.filter((link) => !link.developerOnly || isDeveloper);

  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {visibleLinks.map((link) => {
        const isActive =
          active === link.href ||
          (active === '/scanner' && link.href.startsWith('/scanner?systems=')) ||
          (active.startsWith('/scanner?') && link.href.startsWith('/scanner?systems='));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${linkClass(link.accent, isActive, isLight)}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
