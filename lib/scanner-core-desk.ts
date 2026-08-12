/** Desk constitution for the Core trading page — how to run the main book. */

export type CoreDeskSection = {
  id: string;
  title: string;
  body: string;
  bullets?: string[];
};

export type CoreDeskLink = {
  href: string;
  label: string;
  note: string;
};

export const CORE_DESK_HERO = {
  eyebrow: 'Private scanner · desk constitution',
  title: 'Core',
  summary:
    'This is how you trade the main book. Two cores, overlays for size only, a small fun budget, and dry powder always. Everything else on the scanner is weather or satellite — not a reason to abandon this plan.',
} as const;

export const CORE_DESK_ALLOCATION = [
  {
    label: 'Main block',
    pct: '~70–80%',
    detail: 'Core Hold + QQQ50 Quality Hold (split so you are not all small-caps).',
  },
  {
    label: 'Fun / satellite',
    pct: '~10–15%',
    detail: 'Top Ten, Raw/PT weekly, earnings ideas, COT gold, etc. Cap ~20% only if PowerTrend is ON.',
  },
  {
    label: 'Dry powder',
    pct: '~10–20%',
    detail: 'Always. Even when STACK says FULL — that means full sleeve, not zero cash.',
  },
] as const;

export const CORE_DESK_SECTIONS: CoreDeskSection[] = [
  {
    id: 'job',
    title: 'The job',
    body: 'Run two main sleeves. Do not mash COT, Elliott, agent ranks, and Core into one competing “what to buy” answer.',
    bullets: [
      'Core Hold — IWM quality, top 10, freeze ~2 months, QQQ200 in the recipe.',
      'QQQ50 Quality Hold — large-cap diversifier, freeze monthly.',
      'Everything else = satellite (fun budget) or weather (context only).',
    ],
  },
  {
    id: 'sizing',
    title: 'Daily sizing (STACK)',
    body: 'Open Core + Learned + Sharp Stack on the system scanner. Read the STACK line — it already multiplies the layers.',
    bullets: [
      'Effective book % = Macro/QQQ200 × Learned pain × Sharp pause.',
      'Sharp CASH forces 0% even if Learned says HALF/FULL.',
      'STACK 100% = fully invest the Core sleeve of your main block — not 100% of net worth.',
      'Ignore PowerTrend for Core size (PT is Raw cadence, not Core exposure).',
    ],
  },
  {
    id: 'cadence',
    title: 'Cadence — freeze the book',
    body: 'Trade the Hold sleeves. Live daily ranks and agent numbers are research noise for the main book.',
    bullets: [
      'Core: rebalance every two months; names stay frozen between.',
      'QQQ50 Quality: use the Hold book (monthly freeze).',
      'Do not replace holds because agent #21 or today’s live list looks hotter.',
    ],
  },
  {
    id: 'powertrend',
    title: 'PowerTrend',
    body: 'PT ON does not mean dump Core. It only allows a bigger Raw/weekly satellite inside the fun budget.',
    bullets: [
      'PT OFF (usual): keep fun ~10–15%.',
      'PT ON: fun may stretch toward ~15–20% in Raw weekly / PT hybrid — still not the main block.',
      'Core and QQQ50 Quality stay on their hold cadence either way.',
    ],
  },
  {
    id: 'ignore',
    title: 'Do not let these replace Core',
    body: 'Useful as context or tiny satellites. Not permission to rewrite the main book.',
    bullets: [
      'COT extremes / gold stories',
      'Elliott Wave “near a top”',
      'Agent tournament #1 / short forward windows',
      'Chess management bolted onto Core',
      'Last-year winners or room-to-run as the main picker (fair backtest lost to Core accel)',
      'Avoid chips mid-hold as a reason to rebuild the frozen book',
    ],
  },
  {
    id: 'fun',
    title: 'Fun budget',
    body: 'Stay curious without blowing the plan. Cap all satellites combined.',
    bullets: [
      'Top Ten (veto shortlist), Raw Hold, earnings calendar, day-trade 3×, Flight Deck ideas.',
      'If losing the whole satellite would ruin your month emotionally, it is too big.',
      'Bored with a rising equity curve beats excited with a smoking account.',
    ],
  },
];

export const CORE_DESK_LINKS: CoreDeskLink[] = [
  {
    href: '/scanner?systems=1',
    label: 'System scanner',
    note: 'Core Hold · QQQ50 Quality Hold · Core + Learned + Sharp Stack',
  },
  {
    href: '/scanner/cockpit',
    label: 'Flight Deck',
    note: 'Satellite & context desk — not the main trading rules',
  },
  {
    href: '/scanner/instructions',
    label: 'Instructions',
    note: 'Per-system method notes and caveats',
  },
  {
    href: '/scanner/top-ten',
    label: 'Top Ten',
    note: 'Fun-budget veto shortlist only',
  },
];

export const CORE_DESK_ONE_LINER =
  'Main money: Core + QQQ50 + STACK. Fun money: capped satellites. Dry powder always. Weather panels do not rewrite the book.';
