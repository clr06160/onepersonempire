import type { AgentLeaderboardRow } from '@/lib/scanner-agents';

export type AgentSystemRank = {
  rank: number;
  totalReturnPct: number;
  agentId: string;
  label: string;
};

export function agentRankBySystemId(leaderboard: AgentLeaderboardRow[]): Record<string, AgentSystemRank> {
  const out: Record<string, AgentSystemRank> = {};
  for (const row of leaderboard) {
    const systemId = row.systemId;
    if (!systemId) continue;
    const rank = row.rank ?? 0;
    const existing = out[systemId];
    if (existing && existing.rank <= rank) continue;
    out[systemId] = {
      rank,
      totalReturnPct: row.totalReturnPct,
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
    const rankA = rankMap[a.id]?.rank ?? 9999;
    const rankB = rankMap[b.id]?.rank ?? 9999;
    if (rankA !== rankB) return rankA - rankB;
    return a.id.localeCompare(b.id);
  });
}
