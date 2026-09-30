import test from 'node:test';
import assert from 'node:assert/strict';
import { getCachedPdf, pdfCacheKey, resetPdfCacheForTests, setCachedPdf } from '@/lib/pdf-cache';

test('pdf cache returns the same buffer for an identical render key', () => {
  resetPdfCacheForTests();
  const key = pdfCacheKey({
    content: '# Name',
    template: 'harvard',
    accentColor: '#1a5f7a',
    fontFamily: 'helvetica',
    pageMargin: 36,
    fontSize: 12.5,
  });
  const buffer = Buffer.from('pdf-bytes');
  setCachedPdf(key, buffer, [420]);
  const cached = getCachedPdf(key);
  assert.equal(cached?.buffer.equals(buffer), true);
  assert.deepEqual(cached?.pageBreaks, [420]);
});

test('pdf cache keys change when styling options change', () => {
  const base = {
    content: '# Name',
    template: 'harvard',
    accentColor: '#1a5f7a',
    fontFamily: 'helvetica',
    pageMargin: 36,
    fontSize: 12.5,
  };
  assert.notEqual(pdfCacheKey(base), pdfCacheKey({ ...base, accentColor: '#2ecc71' }));
});
