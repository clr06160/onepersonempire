import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { getAdminFirestore } from '@/lib/firebase-admin';

export type SiteInvoice = {
  id: string;
  siteSlug: string;
  customerName?: string;
  customerPhone?: string;
  description: string;
  amountCents: number;
  currency: string;
  paymentUrl?: string;
  paymentInstructions?: string;
  createdAt: string;
  status: 'open' | 'paid';
};

const INVOICES_DIR = path.join(process.cwd(), 'data', 'invoices');
const INVOICES_COLLECTION = 'siteInvoices';

function isFirestorePublishingEnabled() {
  return process.env.PUBLISH_STORAGE === 'firestore';
}

function assertInvoiceStorageConfiguredForRuntime() {
  if (
    process.env.NODE_ENV === 'production'
    && !isFirestorePublishingEnabled()
    && process.env.ALLOW_LOCAL_PUBLISH_STORAGE !== 'true'
  ) {
    throw new Error('Invoice links need PUBLISH_STORAGE=firestore in production. Set ALLOW_LOCAL_PUBLISH_STORAGE=true only for a temporary tester build.');
  }
}

function invoicePath(id: string) {
  return path.join(INVOICES_DIR, `${id}.json`);
}

function makeInvoiceId() {
  return randomUUID().replace(/-/g, '').slice(0, 14);
}

export function formatInvoiceAmount(amountCents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amountCents / 100);
}

export function extractPaymentLinkFromHtml(html: string) {
  return html.match(/\sdata-stripe-link=(["'])(.*?)\1/i)?.[2]?.trim() || '';
}

export function extractPaymentInstructionsFromHtml(html: string) {
  return html.match(/\sdata-payment-instructions=(["'])(.*?)\1/i)?.[2]
    ?.replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim() || '';
}

export function extractVenmoPhoneFromHtml(html: string) {
  return html.match(/\sdata-venmo-phone=(["'])(.*?)\1/i)?.[2]
    ?.replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim() || '';
}

export function formatVenmoInvoiceInstructions(input: {
  amountCents: number;
  description: string;
  venmoPhone: string;
  currency?: string;
}) {
  return [
    `Pay ${formatInvoiceAmount(input.amountCents, input.currency || 'USD')} with Venmo`,
    '',
    `Send to: ${input.venmoPhone}`,
    `Note: ${input.description}`,
  ].join('\n');
}

export function extractSiteTitleFromHtml(html: string, fallback: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    || fallback;

  return title.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function createInvoice(input: {
  siteSlug: string;
  customerName?: string;
  description: string;
  amountCents: number;
  customerPhone?: string;
  paymentUrl?: string;
  paymentInstructions?: string;
}) {
  assertInvoiceStorageConfiguredForRuntime();
  const now = new Date().toISOString();
  const invoice: SiteInvoice = {
    id: makeInvoiceId(),
    siteSlug: input.siteSlug,
    description: input.description,
    amountCents: input.amountCents,
    currency: 'USD',
    createdAt: now,
    status: 'open',
  };

  if (input.customerName) {
    invoice.customerName = input.customerName;
  }
  if (input.customerPhone) {
    invoice.customerPhone = input.customerPhone;
  }
  if (input.paymentUrl) {
    invoice.paymentUrl = input.paymentUrl;
  }
  if (input.paymentInstructions) {
    invoice.paymentInstructions = input.paymentInstructions;
  }

  if (isFirestorePublishingEnabled()) {
    await getAdminFirestore().collection(INVOICES_COLLECTION).doc(invoice.id).set(invoice);
    return invoice;
  }

  await mkdir(INVOICES_DIR, { recursive: true });
  await writeFile(invoicePath(invoice.id), JSON.stringify(invoice), 'utf8');
  return invoice;
}

export async function getInvoice(id: string) {
  assertInvoiceStorageConfiguredForRuntime();
  const normalized = id.match(/^[a-z0-9]{8,32}$/i)?.[0];
  if (!normalized) return null;

  if (isFirestorePublishingEnabled()) {
    const snapshot = await getAdminFirestore().collection(INVOICES_COLLECTION).doc(normalized).get();
    return snapshot.exists ? snapshot.data() as SiteInvoice : null;
  }

  try {
    return JSON.parse(await readFile(invoicePath(normalized), 'utf8')) as SiteInvoice;
  } catch {
    return null;
  }
}
