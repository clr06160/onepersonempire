export const escapeHtmlAttribute = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

export const escapeHtmlContent = (value: string) => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
);

export const escapeRegExp = (value: string) => (
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
);

export const makeSlug = (value: string) => (
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'my-site'
);
