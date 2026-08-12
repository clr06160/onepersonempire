import type { ForwardLedgerTag } from '@/lib/scanner-forward-ledger-types';

/** Known bitcoin / crypto miners (and close cousins) — primary drag in earnings-reactor sample. */
const CRYPTO_MINERS = new Set(
  [
    'CIFR',
    'HUT',
    'HUT8',
    'MARA',
    'RIOT',
    'CLSK',
    'BITF',
    'IREN',
    'WULF',
    'CORZ',
    'BTBT',
    'BTDR',
    'CAN',
    'GREE',
    'ARBK',
    'ANY',
    'NILE',
    'HIVE',
    'DMGI',
    'EQOS',
  ].map((t) => t.toUpperCase()),
);

const CRYPTO_ADJACENT = new Set(
  ['COIN', 'HOOD', 'MSTR', 'SQ', 'PYPL', 'CRCL', 'BLSH'].map((t) => t.toUpperCase()),
);

/** AI / HPC infra — tag for analysis, not an automatic ban. */
const AI_INFRA = new Set(
  [
    'NVDA',
    'AMD',
    'AVGO',
    'TSM',
    'ASML',
    'SMCI',
    'ARM',
    'PLTR',
    'SNOW',
    'DDOG',
    'NET',
    'CRWD',
    'PANW',
    'DOCN',
    'ESTC',
    'AI',
    'PATH',
    'SOUN',
    'BBAI',
  ].map((t) => t.toUpperCase()),
);

const HIGH_BETA_NARRATIVE = new Set(
  ['RKLB', 'ASTS', 'LUNR', 'OPEN', 'CVNA', 'UPST', 'AFRM', 'SOFI'].map((t) => t.toUpperCase()),
);

function companyHintsCrypto(company?: string | null) {
  const c = String(company || '').toLowerCase();
  if (!c) return false;
  return (
    c.includes('bitcoin') ||
    c.includes('crypto') ||
    c.includes('mining') ||
    c.includes('digital asset') ||
    c.includes('hut 8') ||
    c.includes('cipher')
  );
}

function companyHintsAi(company?: string | null) {
  const c = String(company || '').toLowerCase();
  if (!c) return false;
  return c.includes('semiconductor') || c.includes('gpu') || c.includes('artificial intelligence');
}

export function tagForwardTrade(input: {
  ticker: string;
  company?: string | null;
  returnPct?: number | null;
  stopped?: boolean;
}): ForwardLedgerTag[] {
  const ticker = String(input.ticker || '').toUpperCase();
  const tags = new Set<ForwardLedgerTag>();

  if (CRYPTO_MINERS.has(ticker) || companyHintsCrypto(input.company)) {
    tags.add('crypto-miner');
  }
  if (CRYPTO_ADJACENT.has(ticker)) {
    tags.add('crypto-adjacent');
  }
  if (AI_INFRA.has(ticker) || companyHintsAi(input.company)) {
    tags.add('ai-infra');
  }
  if (HIGH_BETA_NARRATIVE.has(ticker)) {
    tags.add('high-beta-narrative');
  }
  if (input.stopped) tags.add('stopped-out');

  if (input.returnPct != null && !Number.isNaN(input.returnPct)) {
    if (input.returnPct > 0) tags.add('winner');
    if (input.returnPct < 0) tags.add('loser');
  }

  return [...tags];
}

export function isCryptoMinerTag(tags: ForwardLedgerTag[]) {
  return tags.includes('crypto-miner');
}
