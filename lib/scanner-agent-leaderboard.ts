/** Client-safe leaderboard helpers (no Node/Firebase imports). */

export type AgentLeaderboardSortRow = {
  rank?: number;
  agentId: string;
  systemId?: string;
  label?: string;
  totalReturnPct: number;
  maxDrawdownPct?: number;
  equity: number;
  [key: string]: unknown;
};

function asFiniteNumber(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Always rank by displayed % return (highest first). Stale uploads may still be equity-sorted. */
export function normalizeAgentLeaderboard<T extends AgentLeaderboardSortRow>(
  leaderboard: T[] | undefined,
): T[] {
  if (!leaderboard?.length) return [];

  return [...leaderboard]
    .map((row) => ({
      ...row,
      totalReturnPct: asFiniteNumber(row.totalReturnPct, 0),
      equity: asFiniteNumber(row.equity, 0),
      maxDrawdownPct: asFiniteNumber(row.maxDrawdownPct, 0),
    }))
    .sort((a, b) => {
      const retA = asFiniteNumber(a.totalReturnPct, Number.NEGATIVE_INFINITY);
      const retB = asFiniteNumber(b.totalReturnPct, Number.NEGATIVE_INFINITY);
      if (retB !== retA) return retB - retA;
      const eqA = asFiniteNumber(a.equity, 0);
      const eqB = asFiniteNumber(b.equity, 0);
      if (eqB !== eqA) return eqB - eqA;
      return String(a.agentId || '').localeCompare(String(b.agentId || ''));
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
