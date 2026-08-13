import type { CockpitCandidate } from '@/lib/scanner-cockpit';

/** Default Flight Deck knob values (matches ScannerCockpitClient initial state). */
export const COCKPIT_DEFAULT_KNOBS = {
  aggression: 100,
  diversification: 60,
  thrustBoost: 100,
  gravyOn: false,
  breakerForce: false,
} as const;

export function applyMissionBookKnobs(
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

  let targetGross = opts.baseGrossPct;
  targetGross += (opts.aggression - 50) * 0.35;
  targetGross += (opts.thrustBoost - 50) * 0.25;
  if (opts.breakerForce) targetGross = 0;
  targetGross = Math.max(0, Math.min(100, Math.round(targetGross)));

  const scoreSum = names.reduce((s, n) => s + Math.max(n.score, 1), 0) || 1;
  names = names.map((n) => ({
    ...n,
    weightPct: Math.round((Math.max(n.score, 1) / scoreSum) * targetGross * 10) / 10,
  }));

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

  const cash = Math.max(0, Math.round((100 - targetGross) * 10) / 10);

  return { names, gross: targetGross, cash, gravy };
}

export function missionBookTickers(bookNames: CockpitCandidate[], powerTrendOn: boolean, baseGrossPct: number) {
  const tuned = applyMissionBookKnobs(bookNames, {
    ...COCKPIT_DEFAULT_KNOBS,
    powerTrendOn,
    baseGrossPct,
    gravy: null,
  });
  return tuned.names.map((n) => n.ticker.toUpperCase()).filter(Boolean);
}
