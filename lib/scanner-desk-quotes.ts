import deskQuotes from '@/lib/scanner-desk-quotes.json';

export type DeskQuote = {
  day: number;
  text: string;
  school: string;
  voice?: string;
};

type DeskQuotesPayload = {
  version: number;
  note?: string;
  count: number;
  quotes: DeskQuote[];
};

const payload = deskQuotes as DeskQuotesPayload;

/** Day-of-year 1..366 in America/New_York (matches US equity desk). */
export function marketDayOfYear(date = new Date()): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = fmt.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const start = Date.UTC(year, 0, 0);
  const now = Date.UTC(year, month - 1, day);
  return Math.round((now - start) / 86_400_000);
}

export function deskQuoteForDate(date = new Date()): DeskQuote {
  const list = payload.quotes ?? [];
  if (!list.length) {
    return {
      day: 1,
      text: 'Survive the month so you can chase the year.',
      school: 'Dream Tree desk',
    };
  }
  const doy = marketDayOfYear(date);
  // Leap day 366 maps to day 365.
  const idx = ((Math.min(doy, 365) - 1) % list.length + list.length) % list.length;
  return list[idx] ?? list[0];
}

export function deskQuotesMeta(): { count: number; note?: string } {
  return { count: payload.count ?? payload.quotes?.length ?? 0, note: payload.note };
}
