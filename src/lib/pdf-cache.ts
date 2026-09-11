import { createHash } from 'crypto';

const MAX_ENTRIES = 32;
const cache = new Map<string, Buffer>();

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

export function getCachedPdf(key: string): Buffer | undefined {
  const value = cache.get(key);
  if (!value) return undefined;
  cache.delete(key);
  cache.set(key, value);
  return value;
}

export function setCachedPdf(key: string, buffer: Buffer) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, buffer);
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function resetPdfCacheForTests() {
  cache.clear();
}
