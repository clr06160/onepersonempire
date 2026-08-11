import { loadChartData } from '@/lib/charts/load-chart-data';
import { getAdminFirestore, getAdminStorageBucket } from '@/lib/firebase-admin';
import { generateTextWithFallback } from '@/lib/gemini';
import { generateDeskMarketImageDataUrl } from '@/lib/nano-banana';
import { buildCockpitPayload } from '@/lib/scanner-cockpit';
import { loadCockpitForward } from '@/lib/scanner-cockpit-forward';
import { loadScannerCatalystsData, type CatalystRow } from '@/lib/scanner-catalysts-data';
import { loadEarningsCalendarData } from '@/lib/scanner-earnings-data';
import { loadFedWatchData } from '@/lib/scanner-fedwatch-data';
import { loadLeadersDashboard } from '@/lib/scanner-leaders-data';
import { loadMacroCalendarData } from '@/lib/scanner-macro-data';
import { loadScannerNewsData, type ScannerNewsItem } from '@/lib/scanner-news-data';
import { nextUpcomingMeeting, rateLean } from '@/lib/fedwatch-utils';
import { FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'scannerDeskBriefs';
const LATEST_DOC = 'latest';
const IMAGE_PREFIX = 'scanner/desk-brief';

export type DeskBriefSection = {
  id: string;
  title: string;
  body: string;
};

export type DeskBriefPayload = {
  connected: boolean;
  asOf: string;
  generatedAt: string;
  model?: string;
  headline: string;
  sections: DeskBriefSection[];
  bullets?: string[];
  watch?: string[];
  imageBrief?: string;
  imageAlt?: string;
  imagePath?: string;
  imageModel?: string;
  hasImage?: boolean;
  /** Same-origin path for <img src> (auth cookie). */
  imageSrc?: string;
  disclaimer: string;
  message?: string;
  sourceNote?: string;
};

type StoredBrief = DeskBriefPayload & {
  promptVersion?: string;
};

const PROMPT_VERSION = 'desk-brief-v6';

const DEFAULT_DISCLAIMER =
  'Dream Tree desk note — original synthesis for members. Not investment advice. Markets move; size from your own rails.';

function todayAsOf() {
  return new Date().toISOString().slice(0, 10);
}

function imageSrcFor(asOf: string, generatedAt?: string) {
  const base = `/api/scanner/desk-brief/image?asOf=${encodeURIComponent(asOf)}`;
  if (!generatedAt) return base;
  return `${base}&v=${encodeURIComponent(generatedAt)}`;
}

function emptyBrief(message: string): DeskBriefPayload {
  return {
    connected: false,
    asOf: todayAsOf(),
    generatedAt: new Date().toISOString(),
    headline: '',
    sections: [],
    bullets: [],
    watch: [],
    hasImage: false,
    disclaimer: DEFAULT_DISCLAIMER,
    message,
  };
}

function toClientBrief(data: StoredBrief): DeskBriefPayload {
  const asOf = data.asOf || todayAsOf();
  const generatedAt = data.generatedAt || new Date().toISOString();
  const hasImage = Boolean(data.imagePath);
  return {
    connected: true,
    asOf,
    generatedAt,
    model: data.model,
    headline: data.headline || 'Desk note',
    sections: Array.isArray(data.sections) ? data.sections : [],
    bullets: Array.isArray(data.bullets) ? data.bullets : [],
    watch: Array.isArray(data.watch) ? data.watch : [],
    imageBrief: data.imageBrief,
    imageAlt: data.imageAlt || data.headline || 'Morning market mood',
    imagePath: data.imagePath,
    imageModel: data.imageModel,
    hasImage,
    imageSrc: hasImage ? imageSrcFor(asOf, generatedAt) : undefined,
    disclaimer: data.disclaimer || DEFAULT_DISCLAIMER,
    sourceNote: data.sourceNote,
  };
}

export async function loadLatestDeskBrief(): Promise<DeskBriefPayload> {
  const snap = await getAdminFirestore().collection(COLLECTION).doc(LATEST_DOC).get();
  if (!snap.exists) {
    return emptyBrief('Morning note not generated yet. A developer can refresh it.');
  }
  return toClientBrief(snap.data() as StoredBrief);
}

export async function loadDeskBriefImage(asOf?: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const db = getAdminFirestore();
  let path = '';

  if (asOf) {
    const dated = await db.collection(COLLECTION).doc(asOf).get();
    if (dated.exists) {
      const data = dated.data() as StoredBrief;
      path = data.imagePath || '';
    }
  }

  if (!path) {
    const latest = await db.collection(COLLECTION).doc(LATEST_DOC).get();
    if (!latest.exists) return null;
    const data = latest.data() as StoredBrief;
    path = data.imagePath || '';
  }

  if (!path) return null;

  const bucket = getAdminStorageBucket();
  const file = bucket.file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  const contentType = String(metadata.contentType || 'image/png');
  return { buffer, contentType };
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'png';
}

async function saveDeskBriefImage(asOf: string, dataUrl: string, mimeType: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid desk brief image data URL.');
  const buffer = Buffer.from(match[2], 'base64');
  const ext = extensionForMime(mimeType || match[1]);
  const objectPath = `${IMAGE_PREFIX}/${asOf}.${ext}`;
  const bucket = getAdminStorageBucket();
  await bucket.file(objectPath).save(buffer, {
    resumable: false,
    metadata: {
      contentType: mimeType || match[1] || 'image/png',
      cacheControl: 'private, max-age=3600',
    },
  });
  return objectPath;
}

function fmtPct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function newsLine(item: ScannerNewsItem) {
  const when = item.publishedDate || '';
  const tags = (item.tags || []).join('/');
  const ticker = item.ticker ? `${item.ticker} ` : '';
  const bits = [
    `${ticker}${item.title || ''}`.trim(),
    when ? `(${when})` : '',
    tags ? `[${tags}]` : '',
    item.snippet ? `— ${item.snippet.slice(0, 160)}` : '',
  ].filter(Boolean);
  return bits.join(' ');
}

function catalystMoverLine(row: CatalystRow, dayPct?: number | null) {
  const px = row.price;
  const headline = row.latestHeadline?.title || row.headlines?.[0]?.title || '';
  const tags = (row.latestHeadline?.tags || row.tags || []).join('/');
  const earn = row.nextEarnings?.earningsDate
    ? `next earn ${row.nextEarnings.earningsDate}`
    : '';
  const reaction =
    row.nextEarnings?.threeDayReactionPct != null
      ? `3d react ${fmtPct(row.nextEarnings.threeDayReactionPct)}`
      : row.nextEarnings?.immediateReactionPct != null
        ? `react ${fmtPct(row.nextEarnings.immediateReactionPct)}`
        : '';
  const oneDay = dayPct != null ? dayPct : px?.return1dPct;
  return [
    row.ticker,
    `1d ${fmtPct(oneDay)}`,
    `1w ${fmtPct(px?.return1wPct)}`,
    `1m ${fmtPct(px?.return1mPct)}`,
    row.catalystType || '',
    row.evidenceGrade || '',
    row.marketConfirmation || '',
    earn,
    reaction,
    tags ? `[${tags}]` : '',
    headline ? `headline: ${headline}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

type SessionPrint = { pct: number; asOf: string };

type SessionTape = {
  priorSession: Map<string, SessionPrint>;
  overnight: Map<string, SessionPrint>;
  todayEt: string;
};

async function loadSessionTape(tickers: string[]): Promise<SessionTape> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))].slice(
    0,
    40,
  );
  const todayEt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const priorSession = new Map<string, SessionPrint>();
  const overnight = new Map<string, SessionPrint>();

  await Promise.all(
    unique.map(async (ticker) => {
      try {
        const chart = await loadChartData(ticker);
        const bars = chart?.bars || [];
        if (bars.length < 2) return;

        let priorIdx = bars.length - 1;
        for (let i = bars.length - 1; i >= 1; i -= 1) {
          const day = String(bars[i]?.time || '').slice(0, 10);
          if (day && day < todayEt) {
            priorIdx = i;
            break;
          }
          if (day === todayEt && i >= 1) {
            priorIdx = i - 1;
            break;
          }
        }
        if (priorIdx < 1) return;

        const priorPrev = bars[priorIdx - 1];
        const prior = bars[priorIdx];
        if (priorPrev?.close && prior?.close) {
          const pct = ((prior.close - priorPrev.close) / priorPrev.close) * 100;
          if (Number.isFinite(pct)) {
            priorSession.set(ticker, { pct, asOf: String(prior.time || '').slice(0, 10) });
          }
        }

        // Overnight / into today: latest today bar vs prior completed close.
        // Captures AH earnings that gap the next session.
        const last = bars[bars.length - 1];
        const lastDay = String(last?.time || '').slice(0, 10);
        if (last && lastDay === todayEt && prior?.close && last.close && priorIdx === bars.length - 2) {
          const pct = ((last.close - prior.close) / prior.close) * 100;
          if (Number.isFinite(pct)) {
            overnight.set(ticker, { pct, asOf: lastDay });
          }
        }
      } catch {
        // skip missing charts
      }
    }),
  );

  return { priorSession, overnight, todayEt };
}

async function gatherContext(): Promise<string> {
  const [cockpit, forward, macro, fed, catalysts, news, leaders, earningsCal] = await Promise.all([
    buildCockpitPayload().catch(() => null),
    loadCockpitForward().catch(() => null),
    loadMacroCalendarData().catch(() => null),
    loadFedWatchData().catch(() => null),
    loadScannerCatalystsData().catch(() => null),
    loadScannerNewsData().catch(() => null),
    loadLeadersDashboard().catch(() => null),
    loadEarningsCalendarData().catch(() => null),
  ]);

  const book = cockpit?.book;
  const bookTickers = new Set((book?.names || []).map((n) => n.ticker.toUpperCase()));
  const names = (book?.names || [])
    .slice(0, 12)
    .map((n) => `${n.ticker} (~${n.weightPct}%)${n.vetoed ? ' [veto]' : ''}`)
    .join(', ');

  const meeting = nextUpcomingMeeting(fed || undefined);
  const lean = rateLean(meeting);
  const fedLine = meeting
    ? `Next FOMC ${meeting.meetingDate}: lean ${lean?.label || meeting.dominant || 'n/a'} (${lean?.prob ?? '?'}%).`
    : 'FedWatch: no upcoming meeting parsed.';

  const macroDays = (macro?.days || []).slice(0, 7);
  const macroLines = macroDays
    .flatMap((day) =>
      (day.events || [])
        .filter((e) => (e.importance || '').toLowerCase() === 'high' || !e.importance)
        .slice(0, 4)
        .map((e) => `${day.date}: ${e.name}${e.importance ? ` [${e.importance}]` : ''}`),
    )
    .slice(0, 14);

  const themes = (catalysts?.themes || []).slice(0, 8).map((t) => {
    const label = t.label || t.parent || t.key || 'theme';
    return `${label}: ${t.direction || '?'} / ${t.stage || '?'} (${t.tickerCount ?? '?'} names)`;
  });

  const catalystRows = [...(catalysts?.runningNow || []), ...(catalysts?.rows || [])];
  const seenCatalyst = new Set<string>();
  const uniqueCatalystRows: CatalystRow[] = [];
  for (const row of catalystRows) {
    const key = (row.ticker || '').toUpperCase();
    if (!key || seenCatalyst.has(key)) continue;
    seenCatalyst.add(key);
    uniqueCatalystRows.push(row);
  }

  const earningsTagged = uniqueCatalystRows
    .filter((row) => {
      const tags = [...(row.tags || []), ...(row.latestHeadline?.tags || [])].map((t) =>
        t.toLowerCase(),
      );
      const type = (row.catalystType || '').toLowerCase();
      return (
        tags.includes('earnings') ||
        tags.includes('guidance') ||
        type.includes('earn') ||
        Boolean(row.nextEarnings?.earningsDate)
      );
    })
    .slice(0, 16);

  const bookCatalysts = uniqueCatalystRows
    .filter((row) => bookTickers.has((row.ticker || '').toUpperCase()))
    .slice(0, 12);

  const newsTickers = [...(news?.feed || []), ...(news?.market || [])]
    .map((item) => (item.ticker || '').toUpperCase())
    .filter(Boolean);

  const leaderTickers = (leaders?.microsectors || [])
    .flatMap((m) => m.leaders || [])
    .map((t) => t.toUpperCase())
    .slice(0, 24);

  const todayEt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const yesterdayEt = (() => {
    const d = new Date(`${todayEt}T12:00:00-04:00`);
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  })();

  const earningsDays = earningsCal?.days || [];
  const priorEarnings = earningsDays
    .filter((day) => day.date === yesterdayEt || day.date === todayEt)
    .flatMap((day) =>
      (day.stocks || []).map((stock) => ({
        ...stock,
        day: day.date,
      })),
    );
  const priorEarningsTickers = priorEarnings.map((stock) => stock.ticker.toUpperCase());

  const tape = await loadSessionTape([
    'QQQ',
    'SPY',
    ...[...bookTickers],
    ...earningsTagged.map((row) => row.ticker),
    ...newsTickers,
    ...leaderTickers,
    ...priorEarningsTickers,
  ]);

  const priorRows = [...tape.priorSession.entries()]
    .map(([ticker, info]) => ({ ticker, ...info }))
    .sort((a, b) => a.pct - b.pct);
  const priorDown = priorRows.filter((row) => row.pct <= -1.5).slice(0, 12);
  const priorUp = [...priorRows]
    .filter((row) => row.pct >= 1.5)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 12);

  const overnightRows = [...tape.overnight.entries()]
    .map(([ticker, info]) => ({ ticker, ...info }))
    .sort((a, b) => a.pct - b.pct);
  const overnightDown = overnightRows.filter((row) => row.pct <= -2).slice(0, 14);
  const overnightUp = [...overnightRows]
    .filter((row) => row.pct >= 2)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 10);

  const qqqPrior = tape.priorSession.get('QQQ');
  const spyPrior = tape.priorSession.get('SPY');
  const qqqOn = tape.overnight.get('QQQ');
  const spyOn = tape.overnight.get('SPY');

  const combinedMove = (ticker: string) => {
    const on = tape.overnight.get(ticker)?.pct;
    const prior = tape.priorSession.get(ticker)?.pct;
    if (on != null) return Math.abs(on);
    if (prior != null) return Math.abs(prior);
    return 0;
  };

  const movers = [...uniqueCatalystRows]
    .sort(
      (a, b) =>
        combinedMove(b.ticker.toUpperCase()) - combinedMove(a.ticker.toUpperCase()),
    )
    .slice(0, 14);

  const microsectors = [...(leaders?.microsectors || [])].sort(
    (a, b) => (b.rs21 ?? -999) - (a.rs21 ?? -999),
  );
  const hotLeaders = microsectors.slice(0, 6);
  const coldLeaders = [...microsectors]
    .sort((a, b) => (a.rs21 ?? 999) - (b.rs21 ?? 999))
    .slice(0, 6);

  const qqq = leaders?.benchmark?.qqq || {};
  const qqqLine = Object.keys(qqq).length
    ? `QQQ trend benchmark fields (NOT the day tape): ${Object.entries(qqq)
        .slice(0, 8)
        .map(([k, v]) => `${k}=${v == null ? 'n/a' : typeof v === 'number' ? v.toFixed(2) : v}`)
        .join(', ')}`
    : 'QQQ trend benchmark: n/a';

  const leaderRoster = hotLeaders
    .flatMap((m) => (m.leaders || []).slice(0, 3).map((t) => `${t} (${m.label || m.key})`))
    .slice(0, 18);

  const earningsNews = (news?.feed || [])
    .filter((item) => {
      const tags = (item.tags || []).map((t) => t.toLowerCase());
      const title = (item.title || '').toLowerCase();
      return (
        tags.includes('earnings') ||
        tags.includes('guidance') ||
        title.includes('earnings') ||
        title.includes('guidance') ||
        title.includes('eps') ||
        title.includes('outlook')
      );
    })
    .slice(0, 12);

  const marketNews = (news?.market || []).slice(0, 8);
  const recentNews = (news?.feed || []).slice(0, 12);

  const forwardBrief = Array.isArray(forward?.brief) ? forward.brief.slice(0, 8) : [];
  const mission = book?.missionBrief || [];

  const priorAsOf =
    priorRows.find((row) => row.asOf)?.asOf ||
    cockpit?.instruments?.scannerAsOf ||
    book?.asOf ||
    yesterdayEt;

  const earningsLines = priorEarnings.slice(0, 24).map((stock) => {
    const ticker = stock.ticker.toUpperCase();
    const on = tape.overnight.get(ticker);
    const prior = tape.priorSession.get(ticker);
    return `  - ${ticker} report ${stock.day} ${stock.timeLabel || stock.time || ''} · RTH ${fmtPct(prior?.pct)} · AH/overnight ${fmtPct(on?.pct)}`;
  });

  const lines = [
    `As-of date (ET): ${todayEt}`,
    `TWO TAPE LAYERS — both required in the market section:`,
    `1) REGULAR SESSION (RTH) prior close: asOf ${priorAsOf}`,
    `   QQQ RTH: ${fmtPct(qqqPrior?.pct)} | SPY RTH: ${fmtPct(spyPrior?.pct)}`,
    `   Biggest RTH losers:`,
    ...(priorDown.length
      ? priorDown.map((row) => `     - ${row.ticker}: ${fmtPct(row.pct)}`)
      : ['     - none with <= -1.5% in sampled set']),
    `   Biggest RTH winners:`,
    ...(priorUp.length
      ? priorUp.map((row) => `     - ${row.ticker}: ${fmtPct(row.pct)}`)
      : ['     - none with >= +1.5% in sampled set']),
    `2) AFTER-HOURS / OVERNIGHT into today (${todayEt}) — earnings gaps that print after the RTH close:`,
    `   QQQ overnight/into-today: ${fmtPct(qqqOn?.pct)} | SPY overnight/into-today: ${fmtPct(spyOn?.pct)}`,
    `   Biggest overnight losers (often AH earnings):`,
    ...(overnightDown.length
      ? overnightDown.map((row) => `     - ${row.ticker}: ${fmtPct(row.pct)}`)
      : ['     - none with <= -2% in sampled set (or today bar not loaded yet)']),
    `   Biggest overnight winners:`,
    ...(overnightUp.length
      ? overnightUp.map((row) => `     - ${row.ticker}: ${fmtPct(row.pct)}`)
      : ['     - none with >= +2% in sampled set']),
    `CRITICAL: A stock can RIP in RTH and DUMP overnight on AH earnings (e.g. strong RTH then ugly gap). Cover BOTH. Do not write only the RTH rally story if overnight losers are large.`,
    `Earnings calendar near prior day / today:`,
    ...(earningsLines.length ? earningsLines : ['  - none loaded']),
    `Scanner as-of: ${cockpit?.instruments?.scannerAsOf || book?.asOf || 'n/a'}`,
    `Leaders as-of: ${leaders?.asOf || 'n/a'}`,
    `PowerTrend: ${cockpit?.instruments?.powerTrendOn ? 'ON' : 'OFF'} (${cockpit?.instruments?.powerTrend || 'n/a'})`,
    `Regime: ${book?.regimeLabel || cockpit?.instruments?.regimeLabel || 'n/a'}`,
    `Gross / cash: ~${book?.grossExposurePct ?? '?'}% / ~${book?.cashPct ?? '?'}%`,
    `Circuit breaker: ${book?.monthlyBreakerArmed ? 'ARMED' : 'clear'}`,
    `Book names: ${names || 'none'}`,
    qqqLine,
    `Mission brief facts: ${mission.join(' | ') || 'none'}`,
    `Forward paper notes: ${forwardBrief.join(' | ') || 'none'}`,
    fedLine,
    `Policy: ${fed?.policy?.targetLabel || 'n/a'} (eff ${fed?.policy?.effectiveRate ?? 'n/a'})`,
    `Macro week:`,
    ...(macroLines.length ? macroLines.map((l) => `  - ${l}`) : ['  - none loaded']),
    `Leaders microsectors — strongest RS21 (trend backdrop):`,
    ...(hotLeaders.length
      ? hotLeaders.map(
          (m) =>
            `  - ${m.label || m.key}: rs21=${fmtPct(m.rs21)} stage=${m.stage || '?'} leaders=${(m.leaders || []).slice(0, 4).join(',') || 'n/a'}`,
        )
      : ['  - none loaded']),
    `Leaders microsectors — weakest RS21 (trend backdrop):`,
    ...(coldLeaders.length
      ? coldLeaders.map(
          (m) =>
            `  - ${m.label || m.key}: rs21=${fmtPct(m.rs21)} stage=${m.stage || '?'} leaders=${(m.leaders || []).slice(0, 4).join(',') || 'n/a'}`,
        )
      : ['  - none loaded']),
    `Leader roster samples: ${leaderRoster.join(', ') || 'none'}`,
    `Catalyst themes:`,
    ...(themes.length ? themes.map((l) => `  - ${l}`) : ['  - none loaded']),
    `Earnings / guidance catalysts:`,
    ...(earningsTagged.length
      ? earningsTagged.map((row) => {
          const t = row.ticker.toUpperCase();
          return `  - ${catalystMoverLine(row, tape.overnight.get(t)?.pct ?? tape.priorSession.get(t)?.pct)} · overnight ${fmtPct(tape.overnight.get(t)?.pct)} · RTH ${fmtPct(tape.priorSession.get(t)?.pct)}`;
        })
      : ['  - none tagged']),
    `Book catalyst cards:`,
    ...(bookCatalysts.length
      ? bookCatalysts.map((row) => {
          const t = row.ticker.toUpperCase();
          return `  - ${catalystMoverLine(row, tape.overnight.get(t)?.pct ?? tape.priorSession.get(t)?.pct)}`;
        })
      : ['  - none']),
    `Largest overnight-or-RTH movers in catalyst set:`,
    ...(movers.length
      ? movers.map((row) => {
          const t = row.ticker.toUpperCase();
          return `  - ${catalystMoverLine(row, tape.overnight.get(t)?.pct ?? tape.priorSession.get(t)?.pct)} · overnight ${fmtPct(tape.overnight.get(t)?.pct)} · RTH ${fmtPct(tape.priorSession.get(t)?.pct)}`;
        })
      : ['  - none']),
    `Earnings / guidance news facts (internal — synthesize; reconcile to RTH + overnight prints):`,
    ...(earningsNews.length
      ? earningsNews.map((item) => `  - ${newsLine(item)}`)
      : ['  - none']),
    `Market news facts (internal):`,
    ...(marketNews.length ? marketNews.map((item) => `  - ${newsLine(item)}`) : ['  - none']),
    `Recent ticker news facts (internal):`,
    ...(recentNews.length ? recentNews.map((item) => `  - ${newsLine(item)}`) : ['  - none']),
    `Best agent: ${
      cockpit?.instruments?.bestAgent
        ? `#${cockpit.instruments.bestAgent.rank} ${cockpit.instruments.bestAgent.label} (${cockpit.instruments.bestAgent.returnPct.toFixed(1)}%)`
        : 'n/a'
    }`,
  ];

  const joined = lines.join('\n');
  const MAX_CONTEXT_CHARS = 26_000;
  if (joined.length <= MAX_CONTEXT_CHARS) return joined;
  return `${joined.slice(0, MAX_CONTEXT_CHARS)}\n… [facts truncated for model length]`;
}

function sliceBalancedJsonObject(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function sanitizeJsonCandidate(raw: string) {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/\r\n/g, '\n');
}

function extractJsonObject(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text]
    .filter((value): value is string => Boolean(value && value.trim()))
    .map((value) => value.trim());

  const errors: string[] = [];
  for (const candidate of candidates) {
    const balanced = sliceBalancedJsonObject(candidate) || candidate;
    const cleaned = sanitizeJsonCandidate(balanced);
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(
    `Desk brief model did not return JSON.${errors[0] ? ` (${errors[0]})` : ''}`,
  );
}

async function parseDeskBriefJson(text: string, modelHint?: string) {
  try {
    return { parsed: extractJsonObject(text), model: modelHint };
  } catch (firstError) {
    console.warn('[desk-brief] JSON parse failed; attempting repair', firstError);
    const repairPrompt = `Convert the following model output into ONLY valid JSON for a Dream Tree morning desk note.
Keep the same content. Fix truncated strings/brackets if needed.
Required keys: headline, sections (array of {id,title,body}), bullets, watch, imageBrief, imageAlt.
No markdown fences. No commentary.

OUTPUT TO FIX:
${text.slice(0, 12_000)}
`;
    const repaired = await generateTextWithFallback(repairPrompt, {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
      temperature: 0.2,
    });
    return { parsed: extractJsonObject(repaired.text), model: repaired.model || modelHint };
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeSections(value: unknown): DeskBriefSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as { id?: string; title?: string; body?: string };
      const title = String(row.title || '').trim();
      const body = String(row.body || '').trim();
      if (!title || !body) return null;
      return {
        id: String(row.id || `s${index + 1}`).trim() || `s${index + 1}`,
        title,
        body,
      };
    })
    .filter((row): row is DeskBriefSection => Boolean(row));
}

export async function generateAndStoreDeskBrief(): Promise<DeskBriefPayload> {
  const context = await gatherContext();
  const prompt = `You are the Dream Tree Stocks morning desk writer. Write an ORIGINAL daily desk note for paying members.

Primary job: a true morning update with TWO layers —
1) What happened in the prior regular session (RTH)
2) What happened after hours / overnight into today (AH earnings gaps) — this is often the real story for leaders

Hard accuracy rules:
- FACTS has TWO TAPE LAYERS. You must cover both when overnight movers are large.
- Do NOT write only an RTH "tech leaders surge" story if overnight shows big dumps (DDOG/SNDK/EPAM-style gaps).
- Headline should reflect the full overnight-into-morning picture when AH reactions dominate; otherwise lead with RTH.
- Match QQQ/SPY to the printed RTH and overnight numbers in FACTS — do not invent index days.
- Prefer naming concrete RTH winners/losers AND overnight winners/losers. Prior-day / AH earnings are gold.
- 1w/1m/RS21 are backdrop only.
- Original synthesis only. Rewrite news facts; do not paste wire headlines. Do not invent guidance details missing from FACTS.
- Tone: clear desk English. No hype, no emojis, no "as an AI".
- Keep positioning (Core + STACK). PowerTrend does not exit Core; circuit breaker stands down new risk.
- imageBrief: atmospheric metaphor for the full day+overnight mood — no text/logos/charts/tickers.

Section priorities:
1) What moved and why — RTH first, then AH/overnight earnings reactions (or reverse if overnight is the bigger story).
2) What is trending — trend backdrop after the day tape.
3) How to position ahead.
4) Week ahead.

Return ONLY valid JSON with this shape:
{
  "headline": "one sharp line covering the real morning story (RTH and/or AH), max 110 chars",
  "sections": [
    { "id": "market", "title": "What moved and why", "body": "3-5 short paragraphs; include RTH and overnight/AH when both matter" },
    { "id": "trending", "title": "What is trending", "body": "2-3 short paragraphs" },
    { "id": "positioning", "title": "How to position ahead", "body": "2-3 short paragraphs" },
    { "id": "ahead", "title": "Week ahead", "body": "1-2 short paragraphs" }
  ],
  "bullets": ["3 to 6 terse takeaways; mix RTH and overnight when both are material"],
  "watch": ["3 to 8 short watch items; prefer leaders / earnings follow-through"],
  "imageBrief": "2 vivid sentences: atmospheric scene for the day+overnight tape. No text, logos, charts, or tickers.",
  "imageAlt": "short accessibility caption, max 90 chars"
}

FACTS:
${context}
`;

  const first = await generateTextWithFallback(prompt, {
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    temperature: 0.35,
  });
  const { parsed, model } = await parseDeskBriefJson(first.text, first.model);
  const asOf = todayAsOf();
  const generatedAt = new Date().toISOString();
  const headline = String(parsed.headline || 'Morning desk note').trim().slice(0, 160);
  const imageBrief = String(parsed.imageBrief || '').trim();
  const imageAlt = String(parsed.imageAlt || headline).trim().slice(0, 120);
  const marketSection = normalizeSections(parsed.sections).find(
    (s) => s.id === 'market' || s.id === 'tape',
  );

  const payload: StoredBrief = {
    connected: true,
    asOf,
    generatedAt,
    model,
    promptVersion: PROMPT_VERSION,
    headline,
    sections: normalizeSections(parsed.sections),
    bullets: asStringArray(parsed.bullets).slice(0, 8),
    watch: asStringArray(parsed.watch).slice(0, 10),
    imageBrief: imageBrief || undefined,
    imageAlt: imageAlt || headline,
    hasImage: false,
    disclaimer: DEFAULT_DISCLAIMER,
    sourceNote:
      'Synthesized from Dream Tree leaders, catalysts, news facts, Flight Deck, macro, and FedWatch — original desk voice, not a wire reprint. Daily mood image by Nano Banana.',
  };

  if (!payload.sections.length) {
    throw new Error('Desk brief generation returned no sections.');
  }

  try {
    const moodPrompt =
      imageBrief ||
      `Atmospheric market-mood scene for ${asOf}: ${headline}. Regime feel from the desk note.`;
    const image = await generateDeskMarketImageDataUrl({
      asOf,
      headline,
      imageBrief: moodPrompt,
      tapeMood: marketSection?.body?.slice(0, 600),
    });
    payload.imagePath = await saveDeskBriefImage(asOf, image.dataUrl, image.mimeType);
    payload.imageModel = image.model;
    payload.hasImage = true;
  } catch (error) {
    console.warn('[desk-brief] image generation failed; saving note without image', error);
    payload.hasImage = false;
    payload.sourceNote = `${payload.sourceNote} (Image skipped today.)`;
  }

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(LATEST_DOC)
    .set(
      {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );

  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(asOf)
    .set(
      {
        ...payload,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  return toClientBrief(payload);
}
