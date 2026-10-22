import { createHash } from 'crypto';

// Process-local LRU for rendered PDFs. Bounded by entry count, total bytes and age
// so a busy editor session cannot pin hundreds of MB in the web process.
const MAX_ENTRIES = Math.max(4, Number(process.env.PDF_CACHE_MAX_ENTRIES || 64));
const MAX_BYTES = Math.max(1_000_000, Number(process.env.PDF_CACHE_MAX_BYTES || 48 * 1024 * 1024));
const TTL_MS = Math.max(10_000, Number(process.env.PDF_CACHE_TTL_MS || 30 * 60_000));

type Entry = { buffer: Buffer; pageBreaks: number[]; storedAt: number };

export type CachedPdf = { buffer: Buffer; pageBreaks: number[] };

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<CachedPdf>>();
const MAX_IN_FLIGHT = Math.max(8, Number(process.env.PDF_WORKER_MAX_QUEUE) || 64)
  + Math.max(0, Number(process.env.PDF_WORKER_POOL_SIZE) || 2);
let totalBytes = 0;
let renders = 0;
let sharedRenders = 0;

/** Only rendering is shared. Callers must authorize and settle each request separately. */
export async function renderCachedPdf(key: string, render: () => Promise<CachedPdf>) {
  const cached = getCachedPdf(key);
  if (cached) return { ...cached, cacheHit: true, shared: false };
  const pending = inFlight.get(key);
  if (pending) {
    sharedRenders += 1;
    return { ...await pending, cacheHit: false, shared: true };
  }
  if (inFlight.size >= MAX_IN_FLIGHT) throw new Error('PDF renderer is busy; try again shortly');
  renders += 1;
  const task = Promise.resolve().then(render).then(result => {
    setCachedPdf(key, result.buffer, result.pageBreaks);
    return result;
  }).finally(() => { inFlight.delete(key); });
  inFlight.set(key, task);
  return { ...await task, cacheHit: false, shared: false };
}

export type PdfCacheInput = {
  content: string;
  template: string;
  accentColor: string | null;
  fontFamily: string;
  pageMargin: number;
  fontSize: number;
  photoHash?: string | null;
};

export function pdfCacheKey(input: PdfCacheInput) {
  return createHash('sha256').update(JSON.stringify({ layoutVersion: '2026-10-22-photo-columns', ...input })).digest('hex');
}

function remove(key: string) {
  const entry = cache.get(key);
  if (!entry) return;
  cache.delete(key);
  totalBytes -= entry.buffer.byteLength;
}

export function getCachedPdf(key: string): CachedPdf | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.storedAt > TTL_MS) {
    remove(key);
    return undefined;
  }
  // Refresh LRU position.
  cache.delete(key);
  cache.set(key, entry);
  return { buffer: entry.buffer, pageBreaks: entry.pageBreaks };
}

export function setCachedPdf(key: string, buffer: Buffer, pageBreaks: number[] = []) {
  remove(key);
  if (buffer.byteLength > MAX_BYTES) return; // never cache something larger than the whole budget
  cache.set(key, { buffer, pageBreaks, storedAt: Date.now() });
  totalBytes += buffer.byteLength;
  while (cache.size > MAX_ENTRIES || totalBytes > MAX_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    remove(oldest);
  }
}

export function pdfCacheStats() {
  return { entries: cache.size, bytes: totalBytes, inFlight: inFlight.size, renders, sharedRenders };
}

export function resetPdfCacheForTests() {
  cache.clear();
  totalBytes = 0;
  renders = 0;
  sharedRenders = 0;
}
