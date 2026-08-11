import type { ChartBar } from '@/lib/charts/load-chart-data';

export type WaveTarget = {
  label: string;
  price: number;
  kind: 'high' | 'low';
};

export type ElliottWaveQuote = {
  label: string;
  phase: string;
  direction: 'up' | 'down' | 'neutral';
  targets: WaveTarget[];
  /** Projected high for the active wave leg (motive). */
  waveHigh?: number;
  /** Projected low for the active wave leg (corrective). */
  waveLow?: number;
};

type Pivot = {
  index: number;
  time: string;
  price: number;
  type: 'high' | 'low';
};

const FIB = {
  r382: 0.382,
  r50: 0.5,
  r618: 0.618,
  r786: 0.786,
  e100: 1.0,
  e618: 0.618,
  e1618: 1.618,
};

function buildZigZag(bars: ChartBar[], reversalPct: number): Pivot[] {
  if (bars.length < 5) return [];

  const pivots: Pivot[] = [];
  let direction: 'up' | 'down' = 'up';
  let anchorIdx = 0;
  let anchorPrice = bars[0].low;
  let extremeIdx = 0;
  let extremePrice = bars[0].high;

  pivots.push({
    index: 0,
    time: bars[0].time,
    price: bars[0].low,
    type: 'low',
  });

  for (let i = 1; i < bars.length; i += 1) {
    const bar = bars[i];
    if (direction === 'up') {
      if (bar.high >= extremePrice) {
        extremePrice = bar.high;
        extremeIdx = i;
      }
      const reversal = (extremePrice - bar.low) / extremePrice;
      if (reversal >= reversalPct && extremeIdx > anchorIdx) {
        pivots.push({
          index: extremeIdx,
          time: bars[extremeIdx].time,
          price: extremePrice,
          type: 'high',
        });
        direction = 'down';
        anchorIdx = extremeIdx;
        anchorPrice = extremePrice;
        extremePrice = bar.low;
        extremeIdx = i;
      }
    } else {
      if (bar.low <= extremePrice) {
        extremePrice = bar.low;
        extremeIdx = i;
      }
      const reversal = (bar.high - extremePrice) / Math.max(extremePrice, 1e-9);
      if (reversal >= reversalPct && extremeIdx > anchorIdx) {
        pivots.push({
          index: extremeIdx,
          time: bars[extremeIdx].time,
          price: extremePrice,
          type: 'low',
        });
        direction = 'up';
        anchorIdx = extremeIdx;
        anchorPrice = extremePrice;
        extremePrice = bar.high;
        extremeIdx = i;
      }
    }
  }

  const lastBar = bars[bars.length - 1];
  const lastPivot = pivots[pivots.length - 1];
  if (direction === 'up' && lastBar.high > lastPivot.price) {
    pivots.push({
      index: bars.length - 1,
      time: lastBar.time,
      price: lastBar.high,
      type: 'high',
    });
  } else if (direction === 'down' && lastBar.low < lastPivot.price) {
    pivots.push({
      index: bars.length - 1,
      time: lastBar.time,
      price: lastBar.low,
      type: 'low',
    });
  }

  return pivots;
}

function legLength(from: Pivot, to: Pivot): number {
  return Math.abs(to.price - from.price);
}

function impulseDirection(pivots: Pivot[]): 'up' | 'down' {
  if (pivots.length < 2) return 'up';
  return pivots[1].price >= pivots[0].price ? 'up' : 'down';
}

function pickImpulseStart(pivots: Pivot[], direction: 'up' | 'down'): Pivot[] {
  if (pivots.length < 6) return pivots;

  for (let start = pivots.length - 6; start >= 0; start -= 1) {
    const slice = pivots.slice(start, start + 6);
    const expected =
      direction === 'up'
        ? ['low', 'high', 'low', 'high', 'low', 'high']
        : ['high', 'low', 'high', 'low', 'high', 'low'];
    const typesMatch = slice.every((p, i) => p.type === expected[i]);
    if (!typesMatch) continue;

    const w1 = legLength(slice[0], slice[1]);
    const w2 = legLength(slice[1], slice[2]);
    const w3 = legLength(slice[2], slice[3]);
    const w4 = legLength(slice[3], slice[4]);
    const w5 = legLength(slice[4], slice[5]);

    if (w1 <= 0 || w3 <= 0) continue;

    const w2Retrace = w2 / w1;
    const w3Extension = w3 / w1;
    const w4Retrace = w4 / w3;

    const validW2 = w2Retrace >= 0.38 && w2Retrace <= 0.786;
    const validW3 = w3Extension >= 1.0 && w3Extension <= 2.618;
    const validW4 = w4Retrace >= 0.236 && w4Retrace <= 0.618;
    const validW5 = w5 > 0 && w5 <= w3 * 1.618;

    if (validW2 && validW3 && validW4 && validW5) {
      return slice;
    }
  }

  return pivots.slice(-6);
}

function countSubwaves(bars: ChartBar[], startIndex: number, direction: 'up' | 'down'): {
  subwave: number;
  pivots: Pivot[];
} {
  const segment = bars.slice(startIndex);
  if (segment.length < 8) {
    return { subwave: 1, pivots: [] };
  }

  const threshold = 0.015;
  const subPivots = buildZigZag(segment, threshold);
  if (subPivots.length < 2) {
    return { subwave: 1, pivots: subPivots };
  }

  const expectedStart = direction === 'up' ? 'low' : 'high';
  let aligned = subPivots;
  if (subPivots[0].type !== expectedStart) {
    aligned = subPivots.slice(1);
  }

  const completedLegs = Math.max(0, aligned.length - 1);
  const subwave = Math.min(5, Math.max(1, completedLegs));
  return { subwave, pivots: aligned };
}

function analyzeImpulseWave5(
  impulse: Pivot[],
  bars: ChartBar[],
  direction: 'up' | 'down',
): ElliottWaveQuote {
  const [w0, w1, w2, w3, w4, w5] = impulse;
  const wave1Len = legLength(w0, w1);
  const wave3Len = legLength(w2, w3);
  const lastClose = bars[bars.length - 1].close;

  const { subwave, pivots: subPivots } = countSubwaves(bars, w4.index, direction);
  const label = `EW5s${subwave}`;

  let waveHigh: number | undefined;
  let waveLow: number | undefined;
  const targets: WaveTarget[] = [];

  if (direction === 'up') {
    const w5TargetEquality = w4.price + wave1Len;
    const w5Target618 = w4.price + (wave1Len + wave3Len) * FIB.e618;
    const w5Target = Math.max(w5TargetEquality, w5Target618);

    if (subwave === 5) {
      waveHigh = w5Target;
      targets.push({ label: 'W5 high', price: w5Target, kind: 'high' });
    } else if (subwave >= 1 && subPivots.length >= 2) {
      const subStart = subPivots[0];
      const subEnd = subPivots[subPivots.length - 1];
      const subLen = legLength(subStart, subEnd);
      const sub4Low =
        subPivots.length >= 5
          ? subPivots[4].price
          : subPivots.filter((p) => p.type === 'low').at(-1)?.price ?? w4.price;
      const sub5High = sub4Low + subLen * FIB.e618;
      waveHigh = sub5High;
      targets.push({ label: `s${subwave} target`, price: sub5High, kind: 'high' });
      if (subwave < 5) {
        targets.push({ label: 'W5 high', price: w5Target, kind: 'high' });
      }
    } else {
      waveHigh = w5Target;
      targets.push({ label: 'W5 high', price: w5Target, kind: 'high' });
    }

    if (subwave >= 2 && subPivots.length >= 2) {
      const recentLow = subPivots.filter((p) => p.type === 'low').at(-1);
      if (recentLow) {
        waveLow = recentLow.price;
        targets.push({ label: `s${subwave - 1} low`, price: recentLow.price, kind: 'low' });
      }
    }
  } else {
    const w5TargetEquality = w4.price - wave1Len;
    const w5Target618 = w4.price - (wave1Len + wave3Len) * FIB.e618;
    const w5Target = Math.min(w5TargetEquality, w5Target618);

    if (subwave === 5) {
      waveLow = w5Target;
      targets.push({ label: 'W5 low', price: w5Target, kind: 'low' });
    } else {
      waveLow = w5Target;
      targets.push({ label: 'W5 low', price: w5Target, kind: 'low' });
    }
  }

  const inProgress = direction === 'up' ? lastClose < (waveHigh ?? w5.price) : lastClose > (waveLow ?? w5.price);

  return {
    label,
    phase: inProgress ? `Wave 5 · sub ${subwave}` : 'Wave 5 · complete',
    direction: direction === 'up' ? 'up' : 'down',
    targets: dedupeTargets(targets),
    waveHigh,
    waveLow,
  };
}

function analyzeEarlierImpulse(
  impulse: Pivot[],
  direction: 'up' | 'down',
  bars: ChartBar[],
): ElliottWaveQuote | null {
  const lastClose = bars[bars.length - 1].close;
  const pivots = impulse;
  const count = pivots.length;

  if (count < 2) return null;

  let waveNum = count - 1;
  if (waveNum > 5) waveNum = 5;

  const targets: WaveTarget[] = [];
  let label = `EW${waveNum}`;
  let phase = `Wave ${waveNum}`;
  let waveHigh: number | undefined;
  let waveLow: number | undefined;

  if (waveNum === 1 && count >= 2) {
    const w0 = pivots[0];
    const w1 = pivots[1];
    const len = legLength(w0, w1);
    if (direction === 'up') {
      const w2Low = w1.price - len * FIB.r618;
      waveLow = w2Low;
      targets.push({ label: 'W2 low', price: w2Low, kind: 'low' });
    } else {
      const w2High = w1.price + len * FIB.r618;
      waveHigh = w2High;
      targets.push({ label: 'W2 high', price: w2High, kind: 'high' });
    }
  }

  if (waveNum === 3 && count >= 4) {
    const w0 = pivots[0];
    const w1 = pivots[1];
    const w2 = pivots[2];
    const w1Len = legLength(w0, w1);
    if (direction === 'up') {
      const w3High = w2.price + w1Len * FIB.e1618;
      waveHigh = w3High;
      targets.push({ label: 'W3 high', price: w3High, kind: 'high' });
    } else {
      const w3Low = w2.price - w1Len * FIB.e1618;
      waveLow = w3Low;
      targets.push({ label: 'W3 low', price: w3Low, kind: 'low' });
    }
  }

  if (waveNum === 4 && count >= 5) {
    const w2 = pivots[2];
    const w3 = pivots[3];
    const w3Len = legLength(w2, w3);
    if (direction === 'up') {
      const w4Low = w3.price - w3Len * FIB.r382;
      waveLow = w4Low;
      targets.push({ label: 'W4 low', price: w4Low, kind: 'low' });
    } else {
      const w4High = w3.price + w3Len * FIB.r382;
      waveHigh = w4High;
      targets.push({ label: 'W4 high', price: w4High, kind: 'high' });
    }
  }

  return {
    label,
    phase,
    direction: direction === 'up' ? (lastClose >= pivots[pivots.length - 1].price ? 'up' : 'down') : 'down',
    targets: dedupeTargets(targets),
    waveHigh,
    waveLow,
  };
}

function analyzeCorrection(
  impulse: Pivot[],
  bars: ChartBar[],
  direction: 'up' | 'down',
): ElliottWaveQuote {
  const impulseStart = impulse[0];
  const impulseEnd = impulse[impulse.length - 1];
  const impulseRange = Math.abs(impulseEnd.price - impulseStart.price);
  const correctionPivots = buildZigZag(bars.slice(impulseEnd.index), 0.012);

  let corrStart = correctionPivots[0];
  if (corrStart && corrStart.type !== (direction === 'up' ? 'high' : 'low')) {
    correctionPivots.unshift({
      index: 0,
      time: bars[impulseEnd.index].time,
      price: impulseEnd.price,
      type: direction === 'up' ? 'high' : 'low',
    });
  }

  const legs = Math.max(0, correctionPivots.length - 1);
  let waveLetter: 'a' | 'b' | 'c' = 'a';
  if (legs >= 2) waveLetter = 'b';
  if (legs >= 4) waveLetter = 'c';

  const label = `EW-${waveLetter}`;
  const targets: WaveTarget[] = [];
  let waveHigh: number | undefined;
  let waveLow: number | undefined;

  if (direction === 'up') {
    const aLow618 = impulseEnd.price - impulseRange * FIB.r618;
    const aLow382 = impulseEnd.price - impulseRange * FIB.r382;
    const aTarget = aLow618;

    if (waveLetter === 'a') {
      waveLow = aTarget;
      targets.push({ label: 'A low', price: aTarget, kind: 'low' });
      targets.push({ label: 'A low (38.2%)', price: aLow382, kind: 'low' });
    } else if (waveLetter === 'b') {
      const aPivot = correctionPivots.find((p) => p.type === 'low');
      const aLen = aPivot ? impulseEnd.price - aPivot.price : impulseRange * FIB.r618;
      const bHigh = (aPivot?.price ?? aTarget) + aLen * FIB.r618;
      waveHigh = bHigh;
      targets.push({ label: 'B high', price: bHigh, kind: 'high' });
    } else {
      const bPivot = correctionPivots.filter((p) => p.type === 'high').at(-1);
      const aPivot = correctionPivots.filter((p) => p.type === 'low').at(-1);
      const aLen = aPivot ? impulseEnd.price - aPivot.price : impulseRange * FIB.r618;
      const cLow = (bPivot?.price ?? impulseEnd.price) - aLen * FIB.e100;
      waveLow = cLow;
      targets.push({ label: 'C low', price: cLow, kind: 'low' });
    }
  } else {
    const aHigh618 = impulseEnd.price + impulseRange * FIB.r618;
    const aHigh382 = impulseEnd.price + impulseRange * FIB.r382;
    const aTarget = aHigh618;

    if (waveLetter === 'a') {
      waveHigh = aTarget;
      targets.push({ label: 'A high', price: aTarget, kind: 'high' });
      targets.push({ label: 'A high (38.2%)', price: aHigh382, kind: 'high' });
    } else if (waveLetter === 'b') {
      const aPivot = correctionPivots.find((p) => p.type === 'high');
      const aLen = aPivot ? aPivot.price - impulseEnd.price : impulseRange * FIB.r618;
      const bLow = (aPivot?.price ?? aTarget) - aLen * FIB.r618;
      waveLow = bLow;
      targets.push({ label: 'B low', price: bLow, kind: 'low' });
    } else {
      const bPivot = correctionPivots.filter((p) => p.type === 'low').at(-1);
      const aPivot = correctionPivots.filter((p) => p.type === 'high').at(-1);
      const aLen = aPivot ? aPivot.price - impulseEnd.price : impulseRange * FIB.r618;
      const cHigh = (bPivot?.price ?? impulseEnd.price) + aLen * FIB.e100;
      waveHigh = cHigh;
      targets.push({ label: 'C high', price: cHigh, kind: 'high' });
    }
  }

  return {
    label,
    phase: `Correction · wave ${waveLetter.toUpperCase()}`,
    direction: waveLetter === 'a' ? (direction === 'up' ? 'down' : 'up') : waveLetter === 'b' ? (direction === 'up' ? 'up' : 'down') : (direction === 'up' ? 'down' : 'up'),
    targets: dedupeTargets(targets),
    waveHigh,
    waveLow,
  };
}

function dedupeTargets(targets: WaveTarget[]): WaveTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.label}-${target.price.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isCompletedImpulse(pivots: Pivot[], direction: 'up' | 'down'): boolean {
  if (pivots.length < 6) return false;
  const slice = pivots.slice(-6);
  const expected =
    direction === 'up'
      ? ['low', 'high', 'low', 'high', 'low', 'high']
      : ['high', 'low', 'high', 'low', 'high', 'low'];
  return slice.every((p, i) => p.type === expected[i]);
}

function inCorrectionAfterImpulse(
  impulse: Pivot[],
  bars: ChartBar[],
  direction: 'up' | 'down',
): boolean {
  if (!isCompletedImpulse(impulse, direction)) return false;
  const impulseEnd = impulse[impulse.length - 1];
  const lastClose = bars[bars.length - 1].close;
  if (direction === 'up') {
    return lastClose < impulseEnd.price * 0.985;
  }
  return lastClose > impulseEnd.price * 1.015;
}

export function analyzeElliottWave(bars: ChartBar[]): ElliottWaveQuote | null {
  if (bars.length < 40) return null;

  const window = bars.slice(-180);
  const atrPct = estimateAtrPct(window);
  const reversalPct = Math.min(0.08, Math.max(0.025, atrPct * 2.5));
  const pivots = buildZigZag(window, reversalPct);
  if (pivots.length < 4) return null;

  const direction = impulseDirection(pivots);
  const impulse = pickImpulseStart(pivots, direction);

  if (inCorrectionAfterImpulse(impulse, window, direction)) {
    return analyzeCorrection(impulse, window, direction);
  }

  if (impulse.length >= 6 && isCompletedImpulse(impulse, direction)) {
    const lastClose = window[window.length - 1].close;
    const w5 = impulse[5];
    const stillInW5 =
      direction === 'up'
        ? lastClose >= impulse[4].price && lastClose <= w5.price * 1.02
        : lastClose <= impulse[4].price && lastClose >= w5.price * 0.98;
    if (stillInW5) {
      return analyzeImpulseWave5(impulse, window, direction);
    }
    return analyzeCorrection(impulse, window, direction);
  }

  if (impulse.length >= 6) {
    return analyzeImpulseWave5(impulse, window, direction);
  }

  return analyzeEarlierImpulse(impulse, direction, window);
}

function estimateAtrPct(bars: ChartBar[]): number {
  const tail = bars.slice(-20);
  if (tail.length < 2) return 0.04;
  let sum = 0;
  for (let i = 1; i < tail.length; i += 1) {
    const prev = tail[i - 1];
    const cur = tail[i];
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    sum += tr / Math.max(cur.close, 1e-9);
  }
  return sum / (tail.length - 1);
}

export function formatElliottTarget(price: number): string {
  return price >= 100 ? price.toFixed(2) : price.toFixed(4);
}
