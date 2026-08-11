/**
 * User-facing scanner errors should never include opaque backend IDs
 * (GCS/Firebase request digests, colon-hex "MAC-looking" codes, etc.).
 */
const OPAQUE_ID =
  /\b(?:[0-9a-f]{2}:){3,}[0-9a-f]{2}\b|\b[0-9a-f]{16,}\b|\b(?:request|trace|correlation)[_-]?id[=:\s][^\s,]+/gi;

const TECHNICAL =
  /\b(?:gs:\/\/|https?:\/\/|ENOENT|ECONNREFUSED|ETIMEDOUT|firebase|googleapis|storage\.googleapis|credential|iam\.|status[=:\s]?\d{3})\b/i;

export function toScannerUserMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : typeof error === 'string' ? error.trim() : '';
  if (!raw) return fallback;

  // Truncate / scrub opaque IDs first, then decide whether the rest is still useful.
  const scrubbed = raw.replace(OPAQUE_ID, '').replace(/\s{2,}/g, ' ').trim();
  if (!scrubbed || scrubbed.length < 8 || TECHNICAL.test(scrubbed) || TECHNICAL.test(raw)) {
    return fallback;
  }

  // Keep short, human-readable messages (e.g. "Not signed in.") — drop stack-ish blobs.
  if (scrubbed.length > 160 || scrubbed.includes('\n') || scrubbed.includes(' at ')) {
    return fallback;
  }

  return scrubbed;
}
