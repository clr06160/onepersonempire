/** Cory's meta-agent / cockpit trading constitution — satellite & context desk.

Main trading rules live on /scanner/core (Core Hold + QQQ50 + STACK).
Flight Deck synthesizes feeds for the fun budget and situational awareness.
*/

export const COCKPIT_MISSION = {
  yearGoal: 'Maximize calendar-year return without abandoning the Core desk plan.',
  survival: 'Never be down more than ~5% in a single calendar month.',
  style: 'Two cores + capped satellites — not small-cap concentration or chase-the-hot-scan.',
} as const;

export const COCKPIT_RAILS = {
  monthlyCircuitBreakerPct: -5,
  maxRiskPerTradePct: 1,
  preferredStop: '2x ATR (5% stop OK as fallback)',
  maxCoreNames: 18,
  minCoreNames: 8,
  powerTrendGravyMaxPct: 25,
  stayInvestedBias: true,
} as const;

export const COCKPIT_PLAYBOOK: Array<{ id: string; title: string; detail: string }> = [
  {
    id: 'core-desk',
    title: 'Core desk (main book)',
    detail:
      'Core Hold + QQQ50 Quality Hold sized by STACK (Macro/QQQ200 × Learned × Sharp). Read /scanner/core — do not replace this with a hot live scan.',
  },
  {
    id: 'overlap',
    title: 'Multi-scan overlap',
    detail: 'Satellite conviction only — prefer Top Ten / multi-system names with clean charts inside the fun budget.',
  },
  {
    id: 'earnings',
    title: 'Earnings calendar',
    detail: 'Event / satellite sleeve: favor names that worked last earnings when setup + tape agree.',
  },
  {
    id: 'glass-fundamentals',
    title: 'Earnings glass + fundamentals',
    detail: 'Context lens. Prefer room-to-fill for satellite sizing — not a Core replacement (fair backtest lost to Core accel).',
  },
  {
    id: 'catalysts',
    title: 'Catalysts',
    detail: 'Context / satellite: strong catalyst + clean earnings/glass → allow bigger size inside the fun budget.',
  },
  {
    id: 'cot',
    title: 'COT extremes',
    detail: 'Weather only — patient accumulation ideas (e.g. gold), not a reason to dump Core.',
  },
  {
    id: 'fed',
    title: 'Fed / rates / dollar',
    detail: 'Sector bias only: rate-up → careful with growth; rate-down / soft dollar → gold & risk sleeves.',
  },
  {
    id: 'elliott',
    title: 'Elliott Wave',
    detail: 'Bias / weather only (wait / long / short idea). Charts + STACK must confirm — not a Core exit.',
  },
  {
    id: 'powertrend',
    title: 'PowerTrend / regime',
    detail:
      'Does not exit Core. ON → allow a larger Raw/weekly satellite (still capped). OFF → keep fun budget tight.',
  },
  {
    id: 'bear',
    title: 'Raw bear',
    detail: 'Defense radar / near day-trade context — not core book building.',
  },
  {
    id: 'gravy',
    title: '3× leveraged gravy',
    detail: 'Bounce gravy (SOXL etc.) mainly when PowerTrend supports — fun budget only, not the default book.',
  },
  {
    id: 'leaders',
    title: 'Market leaders',
    detail:
      'For satellites: trending leaders with growth + institutional feel. Tag big winners and size down enough to hold.',
  },
];

export const COCKPIT_SUMMARY =
  'Main book is Core + QQQ50 + STACK (/scanner/core). Flight Deck is satellite & context: use overlap, earnings, glass, COT, Fed, and EW for the fun budget and awareness — never to abandon the two cores — and shut new risk if the month is already down >5%.';
