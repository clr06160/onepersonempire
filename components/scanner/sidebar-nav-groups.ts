export type SidebarNavTone = 'amber' | 'emerald';

export type SidebarNavItem = {
  href: string;
  label: string;
  tone: SidebarNavTone;
  developerOnly?: boolean;
};

export type SidebarNavGroup = {
  id: string;
  label: string;
  items: SidebarNavItem[];
};

/** Grouped Access sidebar — same links/colors as live, organized by job. */
export const SIDEBAR_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { href: '/scanner/charts', label: 'Charts', tone: 'amber' },
      { href: '/scanner/daytrade', label: 'Day trade (3× ETFs)', tone: 'amber' },
      { href: '/scanner/agents', label: 'Agent tournament', tone: 'emerald' },
      { href: '/scanner/mistakes', label: 'Mistakes (rules)', tone: 'amber' },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    items: [
      { href: '/scanner/fundamentals', label: 'Proprietary fundamentals', tone: 'emerald' },
      { href: '/scanner/valuations', label: 'Valuations', tone: 'emerald' },
      { href: '/scanner/catalysts', label: 'Catalysts', tone: 'emerald', developerOnly: true },
      { href: '/scanner/top100', label: 'Top 100 stocks', tone: 'emerald' },
      { href: '/scanner/top-ten', label: 'Top Ten', tone: 'emerald' },
      { href: '/scanner/cot', label: 'COT report', tone: 'emerald' },
      { href: '/scanner/fedwatch', label: 'Fed rate odds', tone: 'emerald' },
      { href: '/scanner/macro', label: 'Macro calendar', tone: 'emerald' },
      { href: '/scanner/calendar', label: 'Earnings calendar', tone: 'emerald' },
      { href: '/scanner/options-institutions', label: 'Options/institutions', tone: 'amber' },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    items: [
      { href: '/scanner/forest', label: 'Forest', tone: 'amber' },
      { href: '/scanner/gallery', label: 'Price as art', tone: 'amber' },
      { href: '/scanner/journal', label: 'Trade journal', tone: 'emerald' },
      { href: '/scanner/instructions', label: 'Instructions', tone: 'emerald' },
      { href: '/scanner/monitor', label: 'Adaptive monitor', tone: 'emerald' },
    ],
  },
];

export function sidebarLinkClass(tone: SidebarNavTone): string {
  return tone === 'amber'
    ? 'block text-amber-300 hover:text-amber-200'
    : 'block text-emerald-300 hover:text-emerald-200';
}
