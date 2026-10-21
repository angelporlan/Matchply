import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfDownloadFilename, sanitizeDisplayName } from '@/lib/user-name';

test('sanitizeDisplayName trims and collapses whitespace', () => {
  assert.equal(sanitizeDisplayName('  Carlos   García  '), 'Carlos García');
  assert.equal(sanitizeDisplayName('Ana\nMaría\tGarcía'), 'Ana María García');
});

test('sanitizeDisplayName rejects invalid values', () => {
  assert.equal(sanitizeDisplayName(''), null);
  assert.equal(sanitizeDisplayName('   '), null);
  assert.equal(sanitizeDisplayName('A'), null);
  assert.equal(sanitizeDisplayName('x'.repeat(61)), null);
  assert.equal(sanitizeDisplayName(null), null);
  assert.equal(sanitizeDisplayName(42), null);
  assert.equal(sanitizeDisplayName({ name: 'Ana' }), null);
});

test('sanitizeDisplayName strips control characters', () => {
  assert.equal(sanitizeDisplayName('Ana\u0000\u0007López'), 'Ana López');
});

test('pdfDownloadFilename prefixes the visible name with CV', () => {
  assert.equal(pdfDownloadFilename('  Carlos   García  '), 'CV Carlos García.pdf');
  assert.equal(pdfDownloadFilename('Ana/María: López'), 'CV AnaMaría López.pdf');
  assert.equal(pdfDownloadFilename(''), 'CV.pdf');
  assert.equal(pdfDownloadFilename(null), 'CV.pdf');
  assert.equal(pdfDownloadFilename('A'), 'CV.pdf');
});
