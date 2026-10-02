import test from 'node:test';
import assert from 'node:assert/strict';
import { countPdfPages } from '@/lib/pdf-pages';

test('counts page objects and ignores the page tree', () => {
  const sample = Buffer.from('<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page >>', 'latin1');
  assert.equal(countPdfPages(sample), 2);
});

test('a buffer without page objects still reports one page', () => {
  assert.equal(countPdfPages(Buffer.from('not a pdf')), 1);
});
