/** Closed tag vocab + plain cause lines for earnings prints. No adjectives. */

export const EARNINGS_CAUSE_TAGS = [
  'Sales up',
  'Sales down',
  'Earnings up',
  'Earnings down',
  'Sales lagging',
  'Earnings lagging',
  'Beat guidance',
  'Miss guidance',
  'Sales beat guidance',
  'Sales miss guidance',
  'EPS beat guidance',
  'EPS miss guidance',
  'Opaque',
] as const;

export type EarningsCauseTag = (typeof EARNINGS_CAUSE_TAGS)[number];

export type EarningsPlainFactsInput = {
  eps?: number | null;
  epsEstimated?: number | null;
  revenue?: number | null;
  revenueEstimated?: number | null;
  /** Prior print (older) for sequential up/down. */
  priorEps?: number | null;
  priorRevenue?: number | null;
};

export type EarningsPlainFacts = {
  causeTags: EarningsCauseTag[];
  plainLine: string | null;
};

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function pctDelta(actual: number, baseline: number): number | null {
  if (!baseline) return null;
  return Math.round((1000 * (actual - baseline)) / Math.abs(baseline)) / 10;
}

function fmtPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}%`;
}

function fmtMoney(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${Math.round((value / 1e9) * 10) / 10}B`;
  if (abs >= 1e6) return `$${Math.round((value / 1e6) * 10) / 10}M`;
  return `$${Math.round(value)}`;
}

/**
 * Derive closed tags + 1–2 plain sentences from hard numbers only.
 * "Guidance" here = Street consensus estimate (FMP). Not company-issued outlook.
 */
export function deriveEarningsPlainFacts(input: EarningsPlainFactsInput): EarningsPlainFacts {
  const eps = num(input.eps);
  const epsEst = num(input.epsEstimated);
  const rev = num(input.revenue);
  const revEst = num(input.revenueEstimated);
  const priorEps = num(input.priorEps);
  const priorRev = num(input.priorRevenue);

  const tags: EarningsCauseTag[] = [];
  const sentences: string[] = [];

  const hasAnyNumber =
    eps != null || epsEst != null || rev != null || revEst != null || priorEps != null || priorRev != null;

  if (!hasAnyNumber) {
    return { causeTags: [], plainLine: null };
  }

  let salesUp: boolean | null = null;
  let earningsUp: boolean | null = null;
  let salesVsGuide: boolean | null = null;
  let epsVsGuide: boolean | null = null;

  if (rev != null && priorRev != null && priorRev !== 0) {
    const d = pctDelta(rev, priorRev);
    if (d != null) {
      if (d > 0) {
        tags.push('Sales up');
        salesUp = true;
        sentences.push(`Sales up ${fmtPct(d)} vs prior print (${fmtMoney(rev)}).`);
      } else if (d < 0) {
        tags.push('Sales down');
        salesUp = false;
        sentences.push(`Sales down ${fmtPct(d)} vs prior print (${fmtMoney(rev)}).`);
      }
    }
  }

  if (eps != null && priorEps != null && priorEps !== 0) {
    const d = pctDelta(eps, priorEps);
    if (d != null) {
      if (d > 0) {
        tags.push('Earnings up');
        earningsUp = true;
        sentences.push(`Earnings up ${fmtPct(d)} vs prior print (EPS ${eps}).`);
      } else if (d < 0) {
        tags.push('Earnings down');
        earningsUp = false;
        sentences.push(`Earnings down ${fmtPct(d)} vs prior print (EPS ${eps}).`);
      }
    }
  }

  if (rev != null && revEst != null && revEst !== 0) {
    const d = pctDelta(rev, revEst);
    if (d != null) {
      if (d >= 0) {
        tags.push('Sales beat guidance');
        salesVsGuide = true;
        if (salesUp == null) salesUp = true;
        if (!sentences.some((s) => s.startsWith('Sales '))) {
          sentences.push(`Sales beat Street guidance ${fmtPct(d)} (${fmtMoney(rev)}).`);
        } else {
          sentences.push(`Sales beat Street guidance ${fmtPct(d)}.`);
        }
      } else {
        tags.push('Sales miss guidance');
        salesVsGuide = false;
        if (salesUp == null) salesUp = false;
        if (!sentences.some((s) => s.startsWith('Sales '))) {
          sentences.push(`Sales miss Street guidance ${fmtPct(d)} (${fmtMoney(rev)}).`);
        } else {
          sentences.push(`Sales miss Street guidance ${fmtPct(d)}.`);
        }
      }
    }
  }

  if (eps != null && epsEst != null && epsEst !== 0) {
    const d = pctDelta(eps, epsEst);
    if (d != null) {
      if (d >= 0) {
        tags.push('EPS beat guidance');
        epsVsGuide = true;
        if (earningsUp == null) earningsUp = true;
        if (!sentences.some((s) => s.startsWith('Earnings '))) {
          sentences.push(`EPS beat Street guidance ${fmtPct(d)} (EPS ${eps}).`);
        } else {
          sentences.push(`EPS beat Street guidance ${fmtPct(d)}.`);
        }
      } else {
        tags.push('EPS miss guidance');
        epsVsGuide = false;
        if (earningsUp == null) earningsUp = false;
        if (!sentences.some((s) => s.startsWith('Earnings '))) {
          sentences.push(`EPS miss Street guidance ${fmtPct(d)} (EPS ${eps}).`);
        } else {
          sentences.push(`EPS miss Street guidance ${fmtPct(d)}.`);
        }
      }
    }
  }

  if (salesVsGuide === true && epsVsGuide === true) tags.unshift('Beat guidance');
  else if (salesVsGuide === false && epsVsGuide === false) tags.unshift('Miss guidance');
  else if (salesVsGuide === true && epsVsGuide == null) tags.unshift('Beat guidance');
  else if (epsVsGuide === true && salesVsGuide == null) tags.unshift('Beat guidance');
  else if (salesVsGuide === false && epsVsGuide == null) tags.unshift('Miss guidance');
  else if (epsVsGuide === false && salesVsGuide == null) tags.unshift('Miss guidance');
  // Mixed (beat one / miss one): no rollup — keep the line-item tags only

  if (salesUp === false && earningsUp === true) tags.push('Sales lagging');
  if (earningsUp === false && salesUp === true) tags.push('Earnings lagging');

  // Dedupe while preserving order
  const seen = new Set<string>();
  const causeTags = tags.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });

  if (!causeTags.length && !sentences.length) {
    if (eps == null && rev == null) {
      return { causeTags: ['Opaque'], plainLine: 'No sales or earnings numbers on this print.' };
    }
    const bits: string[] = [];
    if (rev != null) bits.push(`Sales ${fmtMoney(rev)}`);
    if (eps != null) bits.push(`EPS ${eps}`);
    return {
      causeTags: [],
      plainLine: bits.length ? `${bits.join('. ')}.` : null,
    };
  }

  // Prefer at most 2 sentences; prioritize sequential + one guidance line if overflow
  let plainSentences = sentences;
  if (sentences.length > 2) {
    const seq = sentences.filter((s) => s.includes('vs prior print'));
    const guide = sentences.filter((s) => s.includes('Street guidance'));
    plainSentences = [...seq.slice(0, 1), ...guide.slice(0, 1)].slice(0, 2);
    if (plainSentences.length < 2) {
      plainSentences = sentences.slice(0, 2);
    }
  }

  return {
    causeTags,
    plainLine: plainSentences.join(' ') || null,
  };
}
