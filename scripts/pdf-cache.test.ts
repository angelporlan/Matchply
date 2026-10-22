import test from 'node:test';
import assert from 'node:assert/strict';
import { getCachedPdf, pdfCacheKey, resetPdfCacheForTests, setCachedPdf, renderCachedPdf, pdfCacheStats } from '@/lib/pdf-cache';

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

test('concurrent identical PDFs share one render; distinct keys render independently', async () => {
  resetPdfCacheForTests();
  let finish!: (value: { buffer: Buffer; pageBreaks: number[] }) => void;
  let calls = 0;
  const render = () => { calls++; return new Promise<{ buffer: Buffer; pageBreaks: number[] }>(resolve => { finish = resolve; }); };
  const requests = Array.from({ length: 10 }, () => renderCachedPdf('same', render));
  await Promise.resolve();
  assert.equal(calls, 1);
  const other = await renderCachedPdf('other', async () => ({ buffer: Buffer.from('other'), pageBreaks: [] }));
  assert.equal(other.buffer.toString(), 'other');
  finish({ buffer: Buffer.from('identical'), pageBreaks: [420] });
  const results = await Promise.all(requests);
  for (const result of results) { assert.equal(result.buffer.toString(), 'identical'); assert.deepEqual(result.pageBreaks, [420]); }
  assert.equal(results.filter(result => result.shared).length, 9);
  assert.equal(pdfCacheStats().inFlight, 0);
  assert.equal((await renderCachedPdf('same', render)).cacheHit, true);
  assert.equal(calls, 1);
});

test('failed shared PDF generation is removed and can be retried', async () => {
  const failure = () => Promise.reject(new Error('render failed'));
  const results = await Promise.allSettled([renderCachedPdf('retry', failure), renderCachedPdf('retry', failure)]);
  assert.ok(results.every(result => result.status === 'rejected'));
  assert.equal(pdfCacheStats().inFlight, 0);
  assert.equal((await renderCachedPdf('retry', async () => ({ buffer: Buffer.from('ok'), pageBreaks: [] }))).buffer.toString(), 'ok');
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
  assert.notEqual(pdfCacheKey(base), pdfCacheKey({ ...base, photoHash: 'account-photo' }));
  assert.notEqual(pdfCacheKey({ ...base, photoHash: 'account-photo' }), pdfCacheKey({ ...base, photoHash: 'cv-photo' }));
});
