/** Research playbook: wave-4 exit + priors (holdout-tested). */

export type Wave4Prior = {
  key: string;
  label: string;
  avgMovePct: number;
  medianMovePct: number;
  avgMult: number;
  avgDays: number;
  note?: string;
};

/** Industry / theme priors from wave3_length_by_sector study. */
export const WAVE4_PRIORS: Wave4Prior[] = [
  { key: 'tech', label: 'Tech (broad)', avgMovePct: 45, medianMovePct: 29, avgMult: 1.97, avgDays: 105 },
  { key: 'semiconductors', label: 'Semiconductors', avgMovePct: 41, medianMovePct: 33, avgMult: 1.88, avgDays: 122 },
  { key: 'software', label: 'Software', avgMovePct: 42, medianMovePct: 30, avgMult: 1.88, avgDays: 95 },
  {
    key: 'hardware',
    label: 'Hardware / Electronics',
    avgMovePct: 94,
    medianMovePct: 35,
    avgMult: 2.96,
    avgDays: 102,
    note: 'Avg inflated by fat tails — use median ~35% as the prior.',
  },
  { key: 'gold', label: 'Gold / Precious', avgMovePct: 43, medianMovePct: 30, avgMult: 1.84, avgDays: 111 },
  { key: 'oil', label: 'Oil & Gas', avgMovePct: 32, medianMovePct: 26, avgMult: 1.78, avgDays: 103 },
  {
    key: 'oil_integrated',
    label: 'Oil integrated (majors)',
    avgMovePct: 18,
    medianMovePct: 15,
    avgMult: 1.67,
    avgDays: 79,
    note: 'XOM/CVX-style — shorter waves than E&P.',
  },
  { key: 'apparel', label: 'Apparel', avgMovePct: 34, medianMovePct: 29, avgMult: 1.83, avgDays: 90 },
  { key: 'default', label: 'Market default', avgMovePct: 36, medianMovePct: 24, avgMult: 1.85, avgDays: 98 },
];

export const WAVE4_PLAYBOOK = {
  title: 'Wave 4 exit — the reliable part',
  subtitle: 'Ride wave 3. Exit on wave 4. Skip fickle wave 5 if better names exist.',
  rules: [
    'Exact tops are hard because wave 5 is fickle — it can extend or grind for months with a saddle in the middle.',
    'After a sector-sized wave-3 run, trail the stock’s 10- or 21-day MA (character-dependent).',
    'First close below that MA after extension ≈ wave 4 — bank and rotate.',
    'After a full extension, a 50-day break confirms wave 4.',
    'Use industry average % as the expected move; near that length, tighten the trail.',
  ],
  works: [
    { label: 'Tight double bottoms (~0.5% twin lows)', detail: '~74% hit +10% in 63d' },
    { label: '200-DMA stretch +40% / +50%', detail: '~64% / ~77% top-risk (danger zone, not exact top)' },
    { label: 'EW bottoms (5/C down)', detail: '~62–64%' },
    { label: 'Sleeve already hurt (≥60% ≥10% off highs)', detail: 'Pack crash confirm — risk-off together' },
  ],
  weak: [
    'EW wave 5 up as a top call (~45%)',
    'Climax / blowoff bars alone',
    'Fundamentals deteriorating near highs as a timer',
    'Naked double tops without tiredness tags',
  ],
} as const;

export type Wave4StatusCode =
  | 'riding'
  | 'extended'
  | 'about_done'
  | 'confirmed_wave4'
  | 'cooling'
  | 'unknown';

export function priorForIndustry(industry?: string | null, sector?: string | null): Wave4Prior {
  const ind = (industry || '').toLowerCase();
  const sec = (sector || '').toLowerCase();
  if (ind.includes('semiconductor') || sec.includes('semiconductor')) {
    return WAVE4_PRIORS.find((p) => p.key === 'semiconductors')!;
  }
  if (ind.includes('software')) return WAVE4_PRIORS.find((p) => p.key === 'software')!;
  if (ind.includes('hardware') || ind.includes('electronic')) {
    return WAVE4_PRIORS.find((p) => p.key === 'hardware')!;
  }
  if (ind.includes('gold') || ind.includes('silver') || ind.includes('precious')) {
    return WAVE4_PRIORS.find((p) => p.key === 'gold')!;
  }
  if (ind.includes('integrated') && (ind.includes('oil') || sec === 'energy')) {
    return WAVE4_PRIORS.find((p) => p.key === 'oil_integrated')!;
  }
  if (ind.includes('oil') || (ind.includes('gas') && !ind.includes('regulated'))) {
    return WAVE4_PRIORS.find((p) => p.key === 'oil')!;
  }
  if (ind.includes('apparel') || ind.includes('footwear') || ind.includes('luxury')) {
    return WAVE4_PRIORS.find((p) => p.key === 'apparel')!;
  }
  if (sec === 'technology' || ind.includes('semiconductor') || ind.includes('software')) {
    return WAVE4_PRIORS.find((p) => p.key === 'tech')!;
  }
  return WAVE4_PRIORS.find((p) => p.key === 'default')!;
}

export function statusLabel(code: Wave4StatusCode): string {
  switch (code) {
    case 'riding':
      return 'Riding';
    case 'extended':
      return 'Extended';
    case 'about_done':
      return 'About done';
    case 'confirmed_wave4':
      return 'Wave 4';
    case 'cooling':
      return 'Cooling';
    default:
      return '—';
  }
}

export function statusHint(code: Wave4StatusCode): string {
  switch (code) {
    case 'riding':
      return 'Still under the industry prior — trail 10/21.';
    case 'extended':
      return 'At/above prior move — tighten trail; don’t add.';
    case 'about_done':
      return 'Extended + broke 10/21 — bank / rotate (wave 4 tell).';
    case 'confirmed_wave4':
      return 'Broke 50 after extension — wave 4 confirmed.';
    case 'cooling':
      return 'Off highs / below MAs without a full extension.';
    default:
      return '';
  }
}
