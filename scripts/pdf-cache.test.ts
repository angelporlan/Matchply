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
  setCachedPdf(key, buffer);
  assert.equal(getCachedPdf(key)?.equals(buffer), true);
});

test('pdf cache keys change when template options change', () => {
  const base = {
    content: '# Name',
    template: 'harvard',
    accentColor: '#1a5f7a',
    fontFamily: 'helvetica',
    pageMargin: 36,
    fontSize: 12.5,
  };
  assert.notEqual(pdfCacheKey(base), pdfCacheKey({ ...base, template: 'modern' }));
});
