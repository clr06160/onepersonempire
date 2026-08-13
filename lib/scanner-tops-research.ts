/** Full tops/bottoms research pack — holdout-tested numbers for the website. */

import { WAVE4_PLAYBOOK, WAVE4_PRIORS, type Wave4Prior } from '@/lib/scanner-wave4-rules';

export type ResearchStatRow = {
  label: string;
  hitPct: number | null;
  n: number | null;
  note?: string;
};

export type TopsBottomsResearchPack = {
  holdoutNote: string;
  wave4Exit: {
    title: string;
    summary: string;
    process: string[];
    maBreakRows: ResearchStatRow[];
    leftoversNote: string;
  };
  extensions: {
    title: string;
    summary: string;
    rows: ResearchStatRow[];
  };
  tightBottoms: {
    title: string;
    summary: string;
    rows: ResearchStatRow[];
    nuance: string;
  };
  elliott: {
    title: string;
    rows: ResearchStatRow[];
    note: string;
  };
  weakTimers: ResearchStatRow[];
  cohort: {
    title: string;
    summary: string;
    rows: ResearchStatRow[];
  };
  priors: Wave4Prior[];
  playbook: typeof WAVE4_PLAYBOOK;
  exampleSignalsNote: string;
};

/** Holdout seed 42 / 50 random EDGAR charts unless noted. Hit = ±10% extreme in 63d. */
export const TOPS_BOTTOMS_RESEARCH: TopsBottomsResearchPack = {
  holdoutNote:
    'Holdout = 50 random EDGAR charts, seed 42. Hit = price reaches about ±10% the right way within 63 trading days after the signal (unless noted).',

  wave4Exit: {
    title: 'Wave 4 exit — bank after extension, don’t wait for wave 5',
    summary:
      'Wave 5 is fickle (can extend or grind for months). The reliable move is: ride a sector-sized wave 3, then exit when the trail MA fails. That is a banking / rotate rule — not a short call that price must crash 10%.',
    process: [
      'Use the industry prior (table below) as expected wave-3 length.',
      'Near that length, trail the stock’s 10- or 21-day MA (character-dependent).',
      'First close below that MA after extension ≈ wave 4 — bank and rotate.',
      'After a full extension, a 50-day break confirms wave 4.',
      'Skip wave 5 if better names are still in wave 3.',
    ],
    maBreakRows: [
      {
        label: 'SMA10 break after ≥1.618× wave1',
        hitPct: 32.1,
        n: 56,
        note: '−10% within 42d (shakeout). Baseline extended w/ no break ~26%. Weak as a crash predictor.',
      },
      {
        label: 'Same — still leave +10% on table (63d)',
        hitPct: 64.3,
        n: 56,
        note: 'If you exit, ~2/3 of the time another +10% was still available later (wave-5 leftovers).',
      },
      {
        label: 'SMA21 break after ≥1.618× wave1',
        hitPct: 28.6,
        n: 14,
        note: 'Smaller sample; leftover +10% in 63d was ~86% — later trail leaves more on the table.',
      },
      {
        label: 'Median fwd return after SMA10 @ 1.618×',
        hitPct: 6.7,
        n: 56,
        note: 'Median 63d close-to-close still ~+7% after the break — exit banks the run, not the tick top.',
      },
    ],
    leftoversNote:
      'So “probability of getting out on wave 4” is high as a decision (MA break is obvious). Probability that the exact high is in is low — you often leave wave-5 leftovers. That is the tradeoff we accept.',
  },

  extensions: {
    title: '200-DMA extension (top risk)',
    summary:
      'First time price crosses X% above the 200-day. Mild stretch is normal in bulls; extreme stretch is a danger zone (often early — can still run).',
    rows: [
      { label: '+20% above 200-DMA', hitPct: 49, n: 185, note: 'Coin flip for −10% in 63d' },
      { label: '+30% above 200-DMA', hitPct: 48, n: 89, note: 'Still coin flip' },
      { label: '+40% above 200-DMA', hitPct: 64, n: 47, note: 'Yellow→red — trim / don’t add' },
      { label: '+50% above 200-DMA', hitPct: 77, n: 31, note: 'Danger zone; often still runs +5–10% first' },
      { label: '+60% above 200-DMA', hitPct: 57, n: 14, note: 'Thin sample' },
    ],
  },

  tightBottoms: {
    title: 'Double bottoms — symmetry (probability)',
    summary:
      'After neckline confirm: tighter twin lows → much better odds of +10% follow-through. Loose 2.5% twins are barely better than a coin flip.',
    rows: [
      { label: 'Lows within 0.25% (“cents”)', hitPct: 72, n: 29 },
      { label: 'Lows within 0.5%', hitPct: 74, n: 50 },
      { label: 'Lows within 1%', hitPct: 62, n: 91 },
      { label: 'Lows within 2.5% (old loose rule)', hitPct: 53, n: 239 },
      { label: 'Lows 1–2.5% (close but not mirror)', hitPct: 47, n: 148 },
    ],
    nuance:
      'Among tight bottoms (≤1%), a slight undercut of the first low (spring) beat a higher second low (~74% vs ~48%). Prefer mirror ± tiny undercut, then break up.',
  },

  elliott: {
    title: 'Elliott Wave (standalone main turn)',
    rows: [
      { label: 'Wave 5 up only (top)', hitPct: 45, n: null, note: '~coin flip / worse — wave 5 is fickle' },
      { label: 'Wave 5/C down (bottom)', hitPct: 62, n: null, note: 'Modest help near washouts' },
      { label: 'Wave 5/C down near 52w low', hitPct: 64, n: null },
    ],
    note: 'EW as a filter on double tops/bottoms rarely fired. Use bottoms more than tops; do not wait for “perfect wave 5 end.”',
  },

  weakTimers: [
    { label: 'Climax / blowoff bars', hitPct: 50, n: null, note: '~48–51%; warning only' },
    { label: 'TraderLion 5-signal cluster', hitPct: 35, n: null, note: '~35–49%; process warning' },
    { label: 'FCF/NI down near highs', hitPct: 50, n: null, note: '~45–53%; trim flag, not a timer' },
    { label: 'Desk double tops/bottoms (all)', hitPct: 56, n: null, note: 'Modest; late confirms' },
  ],

  cohort: {
    title: 'Growth dying together (momentum sleeve)',
    summary:
      'For momentum traders: individual tops matter less than the whole high-momentum pack rolling. 63d sleeve −10% is common churn; watch 21d pack pain and “already hurt” breadth.',
    rows: [
      {
        label: 'Baseline: sleeve majority −10% in 63d',
        hitPct: 64,
        n: null,
        note: 'Normal for hot names — not a rare regime event',
      },
      {
        label: 'Baseline: pack −15% share in 21d',
        hitPct: 22,
        n: null,
        note: 'True “dying together” target',
      },
      {
        label: '≥60% of sleeve already ≥10% off highs',
        hitPct: 50,
        n: 6,
        note: '~+28pp lift on pack−15%/21d — confirm, not early tip',
      },
    ],
  },

  priors: WAVE4_PRIORS,
  playbook: WAVE4_PLAYBOOK,
  exampleSignalsNote:
    'Example signals below are NOT wave-4 exits. They are holdout double top/bottom confirms that passed the old desk filter (double only, tiredness tags on tops, within ~12% of the swing). Shown so you can see what that secondary study looked like on real charts — mix of follow-through and misses.',
};

export { WAVE4_PLAYBOOK, WAVE4_PRIORS };
