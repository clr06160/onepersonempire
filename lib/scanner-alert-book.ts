import type { CockpitForwardPayload } from '@/lib/scanner-cockpit-forward';

/** Most recent forward trade that changed the book. */
export function latestForwardBookDelta(forward: CockpitForwardPayload) {
  const trades = [...(forward.trades || [])].reverse();
  for (const trade of trades) {
    const added = (trade.added || []).map((t) => String(t).toUpperCase()).filter(Boolean);
    const removed = (trade.removed || []).map((t) => String(t).toUpperCase()).filter(Boolean);
    if (added.length || removed.length) {
      return { added, removed, date: trade.date ? String(trade.date) : undefined };
    }
  }
  return { added: [] as string[], removed: [] as string[], date: undefined as string | undefined };
}
