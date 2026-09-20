import { createHash } from 'crypto';

// Process-local LRU for rendered PDFs. Bounded by entry count, total bytes and age
// so a busy editor session cannot pin hundreds of MB in the web process.
const MAX_ENTRIES = Math.max(4, Number(process.env.PDF_CACHE_MAX_ENTRIES || 64));
const MAX_BYTES = Math.max(1_000_000, Number(process.env.PDF_CACHE_MAX_BYTES || 48 * 1024 * 1024));
const TTL_MS = Math.max(10_000, Number(process.env.PDF_CACHE_TTL_MS || 30 * 60_000));

type Entry = { buffer: Buffer; storedAt: number };

const cache = new Map<string, Entry>();
let totalBytes = 0;

export type PdfCacheInput = {
  content: string;
  template: string;
  accentColor: string | null;
  fontFamily: string;
  pageMargin: number;
  fontSize: number;
};

export function pdfCacheKey(input: PdfCacheInput) {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function remove(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  cache.delete(key);
  totalBytes -= entry.buffer.byteLength;
}

export function getCachedPdf(key: string): Buffer | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > TTL_MS) {
    remove(key);
    return undefined;
  }
  // Refresh LRU position.
  cache.delete(key);
  cache.set(key, entry);
  return entry.buffer;
}

export function setCachedPdf(key: string, buffer: Buffer) {
  remove(key);
  if (buffer.byteLength > MAX_BYTES) return; // never cache something larger than the whole budget
  cache.set(key, { buffer, storedAt: Date.now() });
  totalBytes += buffer.byteLength;
  while (cache.size > MAX_ENTRIES || totalBytes > MAX_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    remove(oldest);
  }
}

export function pdfCacheStats() {
  return { entries: cache.size, bytes: totalBytes };
}

export function resetPdfCacheForTests() {
  cache.clear();
  totalBytes = 0;
}
