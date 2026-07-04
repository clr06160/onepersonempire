'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/** Shared nav across all scanner pages (picks, instructions, fundamentals, COT, monitor). */
const links = [
  { href: '/scanner', label: 'System scanner' },
  { href: '/scanner/charts', label: 'Charts' },
  { href: '/scanner/options-institutions', label: 'Options/institutions' },
  { href: '/scanner/trees', label: 'Market trees' },
  { href: '/scanner/forest', label: 'Forest' },
  { href: '/scanner/gallery', label: 'Price as art' },
  { href: '/scanner/top100', label: 'Top 100' },
  { href: '/scanner/valuations', label: 'Valuations' },
  { href: '/scanner/catalysts', label: 'Catalysts', developerOnly: true },
  { href: '/scanner/cup-handle', label: 'Cup & handle' },
  { href: '/scanner/news', label: 'News', developerOnly: true },
  { href: '/scanner/instructions', label: 'Instructions' },
  { href: '/scanner/monitor', label: 'Adaptive monitor' },
  { href: '/scanner/agents', label: 'Agent tournament' },
  { href: '/scanner/fundamentals', label: 'Proprietary fundamentals' },
  { href: '/scanner/calendar', label: 'Earnings calendar' },
  { href: '/scanner/macro', label: 'Macro calendar' },
  { href: '/scanner/fedwatch', label: 'Fed rate odds' },
  { href: '/scanner/cot', label: 'COT report' },
  { href: '/scanner/requests', label: 'Request a scan' },
];

type ScannerExtrasNavProps = {
  active: string;
  /** Charts use a light page background; other scanner pages use dark. */
  theme?: 'dark' | 'light';
};

export default function ScannerExtrasNav({ active, theme = 'dark' }: ScannerExtrasNavProps) {
  const isLight = theme === 'light';
  // Owner-only links (e.g. licensed news) stay hidden until the session confirms developer role.
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
        const isActive = active === link.href;
        const className = isActive
          ? isLight
            ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
            : 'border-emerald-500 bg-emerald-950 text-emerald-100'
          : isLight
            ? 'border-zinc-500 bg-white text-zinc-900 shadow-sm hover:border-zinc-700 hover:bg-zinc-50'
            : 'border-zinc-500 bg-zinc-900 text-zinc-100 hover:border-zinc-300 hover:bg-zinc-800';

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${className}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
