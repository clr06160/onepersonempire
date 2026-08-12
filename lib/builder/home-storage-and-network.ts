import { makeSlug } from '@/lib/builder/html-utils';

export type BusinessMemory = {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  serviceArea: string;
  services: string;
  pricingNotes: string;
  paymentInfo: string;
  themeStyle: string;
  tone: string;
  notes: string;
};

export type SavedPublishedEdit = {
  slug: string;
  editToken: string;
  publishedUrl: string;
  savedAt: string;
};

export const BUSINESS_MEMORY_STORAGE_KEY = 'ope-business-memory-v1';
export const PUBLISHED_EDIT_STORAGE_KEY = 'ope-published-edits-v1';

export const EMPTY_BUSINESS_MEMORY: BusinessMemory = {
  businessName: '',
  ownerName: '',
  phone: '',
  email: '',
  serviceArea: '',
  services: '',
  pricingNotes: '',
  paymentInfo: '',
  themeStyle: '',
  tone: '',
  notes: '',
};

export const buildEditUrl = (slug: string, editToken: string) => {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin);
  url.searchParams.set('edit', slug);
  url.searchParams.set('key', editToken);
  return url.toString();
};

export const parsePublishedSiteSlug = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      const siteIndex = parts.indexOf('s');
      if (siteIndex >= 0 && parts[siteIndex + 1]) {
        return makeSlug(parts[siteIndex + 1]);
      }
      return makeSlug(parts[parts.length - 1] || '');
    }
  } catch {
    // Fall through to slug parsing.
  }

  return makeSlug(trimmed.replace(/^\/s\//, '').replace(/^\//, ''));
};

export const loadSavedPublishedEdits = (): SavedPublishedEdit[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(PUBLISHED_EDIT_STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as SavedPublishedEdit[]) : [];
    if (parsed.length <= 1) return parsed;
    const latest = [...parsed].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    )[0];
    window.localStorage.setItem(PUBLISHED_EDIT_STORAGE_KEY, JSON.stringify([latest]));
    return [latest];
  } catch (error) {
    console.warn('[published-edit] could not load', error);
    return [];
  }
};

export const savePublishedEditAccess = (entry: SavedPublishedEdit) => {
  replaceSavedPublishedEdit(entry);
};

export const replaceSavedPublishedEdit = (entry: SavedPublishedEdit) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PUBLISHED_EDIT_STORAGE_KEY, JSON.stringify([entry]));
};

export const removeSavedPublishedEdit = (slug: string) => {
  if (typeof window === 'undefined') return;
  const next = loadSavedPublishedEdits().filter((item) => item.slug !== slug);
  window.localStorage.setItem(PUBLISHED_EDIT_STORAGE_KEY, JSON.stringify(next));
};

export const loadStoredBusinessMemory = () => {
  if (typeof window === 'undefined') return EMPTY_BUSINESS_MEMORY;
  try {
    const saved = window.localStorage.getItem(BUSINESS_MEMORY_STORAGE_KEY);
    return saved ? ({ ...EMPTY_BUSINESS_MEMORY, ...JSON.parse(saved) } as BusinessMemory) : EMPTY_BUSINESS_MEMORY;
  } catch (error) {
    console.warn('[business-memory] could not load', error);
    return EMPTY_BUSINESS_MEMORY;
  }
};

export const formatBusinessMemoryContext = (memory: BusinessMemory) => {
  const entries = [
    ['Business name', memory.businessName],
    ['Owner name', memory.ownerName],
    ['Phone', memory.phone],
    ['Email', memory.email],
    ['Service area', memory.serviceArea],
    ['Services/products', memory.services],
    ['Pricing notes', memory.pricingNotes],
    ['Payment info', memory.paymentInfo],
    ['Website theme/style', memory.themeStyle],
    ['Preferred tone', memory.tone],
    ['Business notes', memory.notes],
  ].filter(([, value]) => value.trim());

  if (!entries.length) return '';
  return `Saved business memory:\n${entries.map(([label, value]) => `- ${label}: ${value}`).join('\n')}`;
};

export const formatIdeaWithBusinessMemory = (baseIdea: string, memory: BusinessMemory) => {
  const memoryContext = formatBusinessMemoryContext(memory);
  return memoryContext ? `${baseIdea || 'Use the saved business memory.'}\n\n${memoryContext}` : baseIdea;
};

export const readApiResponse = async (res: Response) => {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const readable = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(readable.slice(0, 500) || `Request failed with status ${res.status}`);
  }
};

export const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

export const openSmsComposer = (message: string) => {
  window.location.href = `sms:?&body=${encodeURIComponent(message)}`;
};

export const openEmailComposer = (email: string, subject: string, body: string) => {
  window.location.href = `mailto:${email.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};
