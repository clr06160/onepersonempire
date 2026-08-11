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

/**
 * Invited viewers: Leaders desk only.
 * Developers: full lab under Workflow / Train / Research / Explore.
 */
export const SIDEBAR_NAV_GROUPS: SidebarNavGroup[] = [
  {
    id: 'desk',
    label: 'Desk',
    items: [
      { href: '/scanner/leaders', label: 'Leaders', tone: 'emerald' },
      { href: '/scanner/monthly-reports', label: 'Monthly reports', tone: 'emerald' },
      { href: '/scanner/cockpit', label: 'Flight Deck', tone: 'amber' },
      { href: '/scanner/desk-brief', label: 'Morning note', tone: 'amber' },
      { href: '/scanner?systems=1', label: 'System scanner', tone: 'emerald' },
      { href: '/scanner/charts', label: 'Charts', tone: 'amber' },
      { href: '/scanner/instructions', label: 'Instructions', tone: 'emerald' },
    ],
  },
  {
    id: 'workflow',
    label: 'Workflow',
    items: [
      { href: '/scanner/core', label: 'Core', tone: 'emerald', developerOnly: true },
      { href: '/scanner/chess-selection', label: 'Chess Selection', tone: 'amber', developerOnly: true },
      { href: '/scanner/daytrade', label: 'Day trade (3× ETFs)', tone: 'amber', developerOnly: true },
      { href: '/scanner/bracket', label: 'Horizontal Bracket', tone: 'amber', developerOnly: true },
      { href: '/scanner/agents', label: 'Agent tournament', tone: 'emerald', developerOnly: true },
    ],
  },
  {
    id: 'train',
    label: 'Train',
    items: [
      { href: '/scanner/mistakes', label: 'Mistakes (rules)', tone: 'amber', developerOnly: true },
      { href: '/scanner/desk-trainer', label: 'Risk Trainer', tone: 'amber', developerOnly: true },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    items: [
      {
        href: '/scanner/fundamentals',
        label: 'Proprietary fundamentals',
        tone: 'emerald',
        developerOnly: true,
      },
      { href: '/scanner/valuations', label: 'Valuations', tone: 'emerald', developerOnly: true },
      { href: '/scanner/earnings-glass', label: 'Earnings glass', tone: 'amber', developerOnly: true },
      { href: '/scanner/raw-bear', label: 'Raw bear (defense)', tone: 'amber', developerOnly: true },
      { href: '/scanner/catalysts', label: 'Catalysts', tone: 'emerald', developerOnly: true },
      { href: '/scanner/top100', label: 'Top 100 stocks', tone: 'emerald', developerOnly: true },
      { href: '/scanner/top-ten', label: 'Top Ten', tone: 'emerald', developerOnly: true },
      { href: '/scanner/cot', label: 'COT report', tone: 'emerald', developerOnly: true },
      { href: '/scanner/probabilities', label: 'Probabilities', tone: 'emerald', developerOnly: true },
      { href: '/scanner/elliott-wave', label: 'Elliott Wave', tone: 'emerald', developerOnly: true },
      { href: '/scanner/first-pullbacks', label: 'First Pullbacks', tone: 'amber', developerOnly: true },
      { href: '/scanner/tops-bottoms', label: 'Tops & bottoms', tone: 'amber', developerOnly: true },
      { href: '/scanner/ipo-short', label: 'Shorting IPOs', tone: 'amber', developerOnly: true },
      { href: '/scanner/fedwatch', label: 'Fed rate odds', tone: 'emerald', developerOnly: true },
      { href: '/scanner/macro', label: 'Macro calendar', tone: 'emerald', developerOnly: true },
      { href: '/scanner/calendar', label: 'Earnings calendar', tone: 'emerald', developerOnly: true },
      {
        href: '/scanner/options-institutions',
        label: 'Options/institutions',
        tone: 'amber',
        developerOnly: true,
      },
    ],
  },
  {
    id: 'explore',
    label: 'Explore',
    items: [
      { href: '/scanner/forest', label: 'Forest', tone: 'amber', developerOnly: true },
      { href: '/scanner/trees', label: 'Market trees', tone: 'amber', developerOnly: true },
      { href: '/scanner/gallery', label: 'Price as art', tone: 'amber', developerOnly: true },
      { href: '/scanner/journal', label: 'Trade journal', tone: 'emerald', developerOnly: true },
      { href: '/scanner/monitor', label: 'Adaptive monitor', tone: 'emerald', developerOnly: true },
      { href: '/scanner/waitlist', label: 'Interest waitlist', tone: 'emerald', developerOnly: true },
      { href: '/scanner/users', label: 'Users', tone: 'emerald', developerOnly: true },
    ],
  },
];

export function sidebarLinkClass(tone: SidebarNavTone): string {
  return tone === 'amber'
    ? 'block text-amber-300 hover:text-amber-200'
    : 'block text-emerald-300 hover:text-emerald-200';
}
