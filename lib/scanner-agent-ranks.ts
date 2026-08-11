import type { AgentLeaderboardRow } from '@/lib/scanner-agents';

export type AgentSystemRank = {
  rank: number;
  totalReturnPct: number;
  agentId: string;
  label: string;
};

export function agentRankBySystemId(leaderboard: AgentLeaderboardRow[]): Record<string, AgentSystemRank> {
  const out: Record<string, AgentSystemRank> = {};
  const asReturn = (value: unknown) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
  };
  const ordered = [...leaderboard].sort((a, b) => {
    const retA = asReturn(a.totalReturnPct);
    const retB = asReturn(b.totalReturnPct);
    if (retB !== retA) return retB - retA;
    return (a.rank ?? 9999) - (b.rank ?? 9999);
  });

  for (const [index, row] of ordered.entries()) {
    const systemId = row.systemId;
    if (!systemId || out[systemId]) continue;
    out[systemId] = {
      rank: row.rank ?? index + 1,
      totalReturnPct: asReturn(row.totalReturnPct) === Number.NEGATIVE_INFINITY ? 0 : asReturn(row.totalReturnPct),
      agentId: row.agentId,
      label: row.label,
    };
  }
  return out;
}

export function formatAgentRankSuffix(meta?: AgentSystemRank): string {
  if (!meta?.rank) return '';
  const sign = meta.totalReturnPct > 0 ? '+' : '';
  return ` (agent #${meta.rank} · ${sign}${meta.totalReturnPct.toFixed(2)}%)`;
}

export function sortSystemsByAgentRank<T extends { id: string }>(
  systems: T[],
  rankMap: Record<string, AgentSystemRank>,
): T[] {
  return [...systems].sort((a, b) => {
    const metaA = rankMap[a.id];
    const metaB = rankMap[b.id];
    const retA = metaA ? metaA.totalReturnPct : Number.NEGATIVE_INFINITY;
    const retB = metaB ? metaB.totalReturnPct : Number.NEGATIVE_INFINITY;
    if (retB !== retA) return retB - retA;
    const rankA = metaA?.rank ?? 9999;
    const rankB = metaB?.rank ?? 9999;
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });
}
