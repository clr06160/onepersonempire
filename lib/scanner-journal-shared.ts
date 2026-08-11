import type { PickContext } from '@/lib/scanner-pick-context';

export type JournalLens =
  | 'top-ten'
  | 'earnings'
  | 'agent'
  | 'scanner'
  | 'manual'
  | 'other';

export type JournalPickSnapshot = {
  capturedAt: string;
  vetoed?: boolean;
  vetoReasons?: string[];
  animal?: string;
  flowSignal?: string;
  runwayScore?: number | null;
  musicStopsRisk?: number | null;
  sixWeekSetupScore?: number | null;
  shortlistRank?: number | null;
  inTopTenBook?: boolean;
  theme?: string;
  sector?: string;
};

export type JournalEntry = {
  id: string;
  ticker: string;
  buyDate: string;
  buyAmount?: number | null;
  sellDate?: string | null;
  sellAmount?: number | null;
  returnPct?: number | null;
  pnlDollars?: number | null;
  reason: string;
  notes?: string;
  lens?: JournalLens;
  status: 'open' | 'closed';
  pickSnapshot?: JournalPickSnapshot | null;
  hasChart?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export function computeJournalReturn(buyAmount?: number | null, sellAmount?: number | null) {
  if (buyAmount == null || sellAmount == null || buyAmount <= 0) {
    return { returnPct: null as number | null, pnlDollars: null as number | null };
  }
  const pnlDollars = sellAmount - buyAmount;
  return { returnPct: (pnlDollars / buyAmount) * 100, pnlDollars };
}

export function slimPickSnapshot(context: PickContext | undefined, capturedAt: string): JournalPickSnapshot | null {
  if (!context) return null;
  const theme = context.theme
    ? [context.theme.label, context.theme.direction, context.theme.stage].filter(Boolean).join(' · ')
    : undefined;
  return {
    capturedAt,
    vetoed: context.vetoed,
    vetoReasons: context.vetoReasons?.length ? [...context.vetoReasons] : [],
    animal: context.animal,
    flowSignal: context.flowSignal,
    runwayScore: context.runwayScore,
    musicStopsRisk: context.musicStopsRisk,
    sixWeekSetupScore: context.sixWeekSetupScore,
    shortlistRank: context.shortlistRank,
    inTopTenBook: context.inTopTenBook,
    theme,
    sector: context.sector,
  };
}

export function formatMoney(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function formatPct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function entryToMarkdown(entry: JournalEntry) {
  const lines = [
    `## ${entry.ticker} (${entry.status})`,
    `- Buy: ${entry.buyDate}${entry.buyAmount != null ? ` @ ${formatMoney(entry.buyAmount)}` : ''}`,
    entry.sellDate
      ? `- Sell: ${entry.sellDate}${entry.sellAmount != null ? ` @ ${formatMoney(entry.sellAmount)}` : ''}`
      : '- Sell: (open)',
  ];
  if (entry.pnlDollars != null) lines.push(`- P&L: ${formatMoney(entry.pnlDollars)} (${formatPct(entry.returnPct)})`);
  lines.push(`- Lens: ${entry.lens || 'manual'}`);
  if (entry.reason) lines.push(`- Reason: ${entry.reason}`);
  if (entry.notes) lines.push(`- Notes: ${entry.notes}`);
  if (entry.hasChart) lines.push('- Chart: attached (see journal UI)');
  if (entry.pickSnapshot) {
    const s = entry.pickSnapshot;
    lines.push(
      `- Chips @ ${s.capturedAt}: ${s.vetoed ? 'Avoid' : 'OK'}${s.flowSignal ? ` · ${s.flowSignal}` : ''}${s.animal ? ` · ${s.animal}` : ''}${s.inTopTenBook ? ' · Top 10' : ''}`,
    );
    if (s.vetoReasons?.length) lines.push(`- Veto reasons: ${s.vetoReasons.join('; ')}`);
  }
  return lines.join('\n');
}

export function journalSummary(entries: JournalEntry[]) {
  let realizedPnl = 0;
  let closedWithPnl = 0;
  let wins = 0;
  for (const entry of entries) {
    if (entry.status === 'closed' && entry.pnlDollars != null) {
      realizedPnl += entry.pnlDollars;
      closedWithPnl += 1;
      if (entry.pnlDollars > 0) wins += 1;
    }
  }
  const openCount = entries.filter((e) => e.status === 'open').length;
  return {
    total: entries.length,
    openCount,
    closedCount: entries.length - openCount,
    realizedPnl,
    closedWithPnl,
    winRatePct: closedWithPnl ? Math.round((wins / closedWithPnl) * 100) : null,
  };
}
