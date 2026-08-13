import { listForwardLedgerTrades, upsertForwardLedgerTrades, normalizeLedgerTrade } from '@/lib/scanner-forward-ledger';
import type {
  ForwardLedgerSyncResult,
  ForwardLedgerSystemId,
  ForwardLedgerTrade,
} from '@/lib/scanner-forward-ledger-types';
import { loadBracketDashboard } from '@/lib/scanner-bracket-data';
import { loadScannerCatalystsData } from '@/lib/scanner-catalysts-data';
import { loadChessSelectionDashboard } from '@/lib/scanner-chess-selection-data';
import { loadCockpitForward } from '@/lib/scanner-cockpit-forward';
import { loadCotReportData } from '@/lib/scanner-cot-data';
import { loadScannerDayTradeData } from '@/lib/scanner-daytrade-data';
import { loadEarningsCalendarData } from '@/lib/scanner-earnings-data';
import { loadFirstPullbackDashboard } from '@/lib/scanner-first-pullback-data';
import { loadPeGlassDashboard } from '@/lib/scanner-pe-glass-data';
import { loadRawBearDashboard } from '@/lib/scanner-raw-bear-data';
import { loadScannerShortlistData } from '@/lib/scanner-shortlist-data';
import { loadEbitdaMarginData } from '@/lib/ebitda-data';
import { loadScannerValuationsData } from '@/lib/scanner-valuations-data';
import { toScannerUserMessage } from '@/lib/scanner-user-error';

function pushTrade(bucket: ForwardLedgerTrade[], trade: ForwardLedgerTrade | null) {
  if (trade) bucket.push(trade);
}

async function collectEarningsCalendar(): Promise<ForwardLedgerTrade[]> {
  const data = await loadEarningsCalendarData();
  const live = data.forwardTest?.live;
  const out: ForwardLedgerTrade[] = [];

  for (const row of live?.recentClosed || []) {
    pushTrade(
      out,
      normalizeLedgerTrade({
        systemId: 'earnings-calendar',
        systemLabel: 'Earnings calendar reactors',
        ticker: String(row.ticker || ''),
        company: row.company,
        entryDate: String(row.entryDate || ''),
        exitDate: String(row.exitDate || ''),
        entryPrice: row.entryPrice,
        exitPrice: row.exitPrice,
        returnPct: row.returnPct,
        stopped: Boolean(row.stopped),
        exitReason: row.exitReason,
        status: 'closed',
        sourceNote: row.earningsDate ? `Earnings ${row.earningsDate}` : null,
      }),
    );
  }

  const openRows = live?.openPositions?.length
    ? live.openPositions
    : live?.openPosition
      ? [live.openPosition]
      : [];
  for (const row of openRows) {
    pushTrade(
      out,
      normalizeLedgerTrade({
        systemId: 'earnings-calendar',
        systemLabel: 'Earnings calendar reactors',
        ticker: String(row.ticker || ''),
        company: row.company,
        entryDate: String(row.entryDate || ''),
        exitDate: null,
        entryPrice: row.entryPrice,
        exitPrice: row.lastPrice,
        returnPct: row.currentReturnPct ?? row.returnPct,
        stopped: Boolean(row.stopped),
        exitReason: row.exitReason,
        status: 'open',
        sourceNote: row.earningsDate ? `Earnings ${row.earningsDate}` : null,
      }),
    );
  }

  return out;
}

async function collectShortlist(): Promise<ForwardLedgerTrade[]> {
  const data = await loadScannerShortlistData();
  const out: ForwardLedgerTrade[] = [];
  for (const row of data.forwardTest?.recentClosed || []) {
    pushTrade(
      out,
      normalizeLedgerTrade({
        systemId: 'shortlist',
        systemLabel: 'Top Ten / shortlist',
        ticker: String(row.ticker || ''),
        company: row.company,
        entryDate: String(row.entryDate || ''),
        exitDate: String(row.exitDate || row.lastDate || ''),
        entryPrice: row.entryPrice,
        exitPrice: row.exitPrice ?? row.lastPrice,
        returnPct: row.returnPct ?? row.currentReturnPct,
        status: 'closed',
      }),
    );
  }
  return out;
}

async function collectEbitdaMargins(): Promise<ForwardLedgerTrade[]> {
  const data = await loadEbitdaMarginData();
  const out: ForwardLedgerTrade[] = [];
  for (const universe of data.forwardTest?.universes || []) {
    for (const row of universe.recentClosed || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'ebitda-margins',
          systemLabel: 'EBITDA margin top 10',
          sleeve: universe.key || universe.label,
          ticker: String(row.ticker || ''),
          company: row.company,
          entryDate: String(row.entryDate || ''),
          exitDate: String(row.exitDate || row.lastDate || ''),
          entryPrice: row.entryPrice,
          exitPrice: row.exitPrice ?? row.lastPrice,
          returnPct: row.returnPct ?? row.currentReturnPct,
          status: 'closed',
          sourceNote: universe.label ? `Universe ${universe.label}` : null,
        }),
      );
    }
    for (const row of universe.openPositions || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'ebitda-margins',
          systemLabel: 'EBITDA margin top 10',
          sleeve: universe.key || universe.label,
          ticker: String(row.ticker || ''),
          company: row.company,
          entryDate: String(row.entryDate || ''),
          exitDate: null,
          entryPrice: row.entryPrice,
          exitPrice: row.lastPrice,
          returnPct: row.currentReturnPct ?? row.returnPct,
          status: 'open',
          sourceNote: universe.label ? `Universe ${universe.label}` : null,
        }),
      );
    }
  }
  return out;
}

async function collectCatalysts(): Promise<ForwardLedgerTrade[]> {
  const data = await loadScannerCatalystsData();
  const out: ForwardLedgerTrade[] = [];
  for (const group of data.forwardTest?.groups || []) {
    for (const row of group.recentClosed || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'catalysts',
          systemLabel: 'Catalysts',
          sleeve: group.key || group.label,
          ticker: String(row.ticker || ''),
          company: row.company,
          entryDate: String(row.entryDate || ''),
          exitDate: String(row.lastDate || ''),
          entryPrice: row.entryPrice,
          exitPrice: row.lastPrice,
          returnPct: row.returnPct ?? row.currentReturnPct,
          status: 'closed',
          sourceNote: row.entryConfirmation ? `Confirm ${row.entryConfirmation}` : null,
        }),
      );
    }
  }
  return out;
}

async function collectValuations(): Promise<ForwardLedgerTrade[]> {
  const data = await loadScannerValuationsData();
  const out: ForwardLedgerTrade[] = [];
  for (const group of data.forwardTest?.groups || []) {
    for (const row of group.recentClosed || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'valuations',
          systemLabel: 'Valuations',
          sleeve: group.key || group.kind,
          ticker: String(row.ticker || ''),
          company: row.company,
          entryDate: String(row.entryDate || ''),
          exitDate: String(row.lastDate || ''),
          entryPrice: row.entryPrice,
          exitPrice: row.lastPrice,
          returnPct: row.returnPct ?? row.currentReturnPct,
          status: 'closed',
          sourceNote: row.entryAnimal ? `Animal ${row.entryAnimal}` : null,
        }),
      );
    }
  }
  return out;
}

async function collectDaytrade(): Promise<ForwardLedgerTrade[]> {
  const data = await loadScannerDayTradeData();
  const out: ForwardLedgerTrade[] = [];
  const books: { systemId: ForwardLedgerSystemId; label: string; rows: NonNullable<NonNullable<typeof data.soxsFailedBounce>['paper']>['recentClosed'] }[] = [
    {
      systemId: 'daytrade-soxs',
      label: 'Day trade · SOXS failed bounce',
      rows: data.soxsFailedBounce?.paper?.recentClosed || [],
    },
    {
      systemId: 'daytrade-armor',
      label: 'Day trade · bounce-fail armor',
      rows: data.bounceFailArmor?.paper?.recentClosed || [],
    },
  ];

  for (const book of books) {
    for (const row of book.rows || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: book.systemId,
          systemLabel: book.label,
          ticker: String(row.ticker || ''),
          entryDate: String(row.entryDate || ''),
          exitDate: String(row.exitDate || ''),
          entryPrice: row.entryPrice,
          exitPrice: row.exitPrice,
          returnPct: row.returnPct,
          exitReason: row.exitReason,
          status: 'closed',
        }),
      );
    }
  }
  return out;
}

async function collectChess(): Promise<ForwardLedgerTrade[]> {
  const data = await loadChessSelectionDashboard();
  const out: ForwardLedgerTrade[] = [];
  for (const variant of data.variants || []) {
    for (const row of variant.recentClosed || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'chess-selection',
          systemLabel: 'Chess selection',
          sleeve: variant.id,
          ticker: String(row.ticker || ''),
          entryDate: String(row.openedAt || '').slice(0, 10),
          exitDate: String(row.closedAt || '').slice(0, 10),
          entryPrice: row.entryPrice,
          exitPrice: row.exitPrice,
          returnPct: row.returnPct,
          status: 'closed',
        }),
      );
    }
  }
  return out;
}

async function collectPeriodBaskets(): Promise<ForwardLedgerTrade[]> {
  const out: ForwardLedgerTrade[] = [];

  try {
    const cot = await loadCotReportData();
    for (const sleeve of cot.forwardTest?.sleeves || []) {
      for (const period of sleeve.recentPeriods || []) {
        const ticker = `COT:${sleeve.key || 'sleeve'}`;
        pushTrade(
          out,
          normalizeLedgerTrade({
            systemId: 'cot',
            systemLabel: 'COT sleeves',
            kind: 'basket',
            sleeve: sleeve.key,
            ticker,
            entryDate: String(period.entryDate || period.from || ''),
            exitDate: String(period.exitDate || period.to || ''),
            returnPct: period.returnPct,
            status: 'closed',
            sourceNote: `markets ${period.marketCount ?? '—'}`,
          }),
        );
      }
    }
  } catch {
    // optional
  }

  try {
    const raw = await loadRawBearDashboard();
    for (const universe of raw.forwardTest?.universes || []) {
      for (const period of universe.recentPeriods || []) {
        pushTrade(
          out,
          normalizeLedgerTrade({
            systemId: 'raw-bear',
            systemLabel: 'Raw bear',
            kind: 'basket',
            sleeve: universe.key,
            ticker: `BEAR:${universe.key || 'u'}`,
            entryDate: String(period.from || ''),
            exitDate: String(period.to || ''),
            returnPct: period.returnPct,
            status: 'closed',
            sourceNote: `${period.count ?? period.tickers?.length ?? 0} names`,
          }),
        );
      }
    }
  } catch {
    // optional
  }

  try {
    const pe = await loadPeGlassDashboard();
    for (const bucket of pe.forwardTest?.buckets || []) {
      for (const period of bucket.recentPeriods || []) {
        pushTrade(
          out,
          normalizeLedgerTrade({
            systemId: 'pe-glass',
            systemLabel: 'Earnings glass',
            kind: 'basket',
            sleeve: bucket.key,
            ticker: `PE:${bucket.key || 'b'}`,
            entryDate: String(period.from || ''),
            exitDate: String(period.to || ''),
            returnPct: period.returnPct,
            status: 'closed',
            sourceNote: `${period.count ?? period.tickers?.length ?? 0} names`,
          }),
        );
      }
    }
  } catch {
    // optional
  }

  try {
    const fp = await loadFirstPullbackDashboard();
    const books = fp.forwardTest?.books?.length ? fp.forwardTest.books : fp.book ? [fp.book] : [];
    for (const book of books) {
      const sleeve = book.id || book.label || 'book';
      for (const period of book.recentPeriods || []) {
        pushTrade(
          out,
          normalizeLedgerTrade({
            systemId: 'first-pullbacks',
            systemLabel: 'First pullbacks',
            kind: 'basket',
            sleeve,
            ticker: `FP:${sleeve}`,
            entryDate: String(period.from || ''),
            exitDate: String(period.to || ''),
            returnPct: period.returnPct,
            status: 'closed',
            sourceNote: `${period.count ?? period.tickers?.length ?? 0} names`,
          }),
        );
      }
    }
  } catch {
    // optional
  }

  try {
    const bracket = await loadBracketDashboard();
    for (const day of bracket.forwardTest?.recent || []) {
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'bracket',
          systemLabel: 'Horizontal bracket',
          kind: 'basket',
          ticker: 'BRACKET',
          entryDate: String(day.asOf || ''),
          exitDate: String(day.asOf || ''),
          returnPct: day.comboOvernightPct,
          status: 'closed',
          sourceNote: `buy ${(day.buyTickers || []).length} / sell ${(day.sellTickers || []).length}`,
        }),
      );
    }
  } catch {
    // optional
  }

  try {
    const cockpit = await loadCockpitForward();
    for (const event of cockpit.trades || []) {
      if (event.monthReturnPct == null) continue;
      pushTrade(
        out,
        normalizeLedgerTrade({
          systemId: 'cockpit',
          systemLabel: 'Flight Deck paper book',
          kind: 'event',
          ticker: 'COCKPIT',
          sleeve: event.type,
          entryDate: String(event.date || ''),
          exitDate: String(event.date || ''),
          returnPct: event.monthReturnPct,
          status: 'closed',
          sourceNote: event.reason || null,
        }),
      );
    }
  } catch {
    // optional
  }

  return out;
}

const COLLECTORS: {
  systemId: string;
  run: () => Promise<ForwardLedgerTrade[]>;
}[] = [
  { systemId: 'earnings-calendar', run: collectEarningsCalendar },
  { systemId: 'shortlist', run: collectShortlist },
  { systemId: 'ebitda-margins', run: collectEbitdaMargins },
  { systemId: 'catalysts', run: collectCatalysts },
  { systemId: 'valuations', run: collectValuations },
  { systemId: 'daytrade', run: collectDaytrade },
  { systemId: 'chess-selection', run: collectChess },
  { systemId: 'period-baskets', run: collectPeriodBaskets },
];

/** Pull closed/open paper trades from every forward test and upsert into the ledger. */
export async function syncForwardLedgerFromSystems(): Promise<{
  sync: ForwardLedgerSyncResult;
  trades: ForwardLedgerTrade[];
}> {
  const trades: ForwardLedgerTrade[] = [];
  const errors: { systemId: string; message: string }[] = [];
  let scannedSystems = 0;

  for (const collector of COLLECTORS) {
    scannedSystems += 1;
    try {
      const rows = await collector.run();
      trades.push(...rows);
    } catch (error) {
      errors.push({
        systemId: collector.systemId,
        message: toScannerUserMessage(error, `Could not read ${collector.systemId}.`),
      });
    }
  }

  // Dedupe by id (last write wins)
  const byId = new Map<string, ForwardLedgerTrade>();
  for (const trade of trades) byId.set(trade.id, trade);
  const unique = [...byId.values()];

  let upserted = 0;
  try {
    const result = await upsertForwardLedgerTrades(unique);
    upserted = result.upserted;
  } catch (error) {
    errors.push({
      systemId: 'ledger-store',
      message: toScannerUserMessage(error, 'Could not write ledger to Firestore.'),
    });
  }

  const closedSeen = unique.filter((t) => t.status === 'closed').length;
  const openSeen = unique.filter((t) => t.status === 'open').length;

  return {
    trades: unique,
    sync: {
      scannedSystems,
      upserted,
      closedSeen,
      openSeen,
      errors,
      asOf: new Date().toISOString(),
    },
  };
}

/** Prefer persisted ledger; if empty (or forceSync), sync from live forward tests. */
export async function loadForwardLedgerTrades(options?: {
  monthKey?: string | null;
  systemId?: string | null;
  forceSync?: boolean;
}): Promise<{ trades: ForwardLedgerTrade[]; sync: ForwardLedgerSyncResult | null }> {
  let sync: ForwardLedgerSyncResult | null = null;

  if (options?.forceSync) {
    const synced = await syncForwardLedgerFromSystems();
    sync = synced.sync;
  }

  let trades = await listForwardLedgerTrades({
    monthKey: options?.monthKey,
    systemId: options?.systemId,
  }).catch(() => [] as ForwardLedgerTrade[]);

  if (!trades.length && !options?.forceSync) {
    const synced = await syncForwardLedgerFromSystems();
    sync = synced.sync;
    trades = await listForwardLedgerTrades({
      monthKey: options?.monthKey,
      systemId: options?.systemId,
    }).catch(() =>
      synced.trades.filter((t) => {
        if (options?.monthKey && t.monthKey !== options.monthKey) return false;
        if (options?.systemId && t.systemId !== options.systemId) return false;
        return true;
      }),
    );
  }

  return { trades, sync };
}
