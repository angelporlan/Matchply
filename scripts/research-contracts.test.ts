import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicHttpUrl } from '@/lib/research/providers';
import { clampConfidence, clampScore } from '@/lib/research/types';

test('SSRF guard accepts public HTTP(S) and canonicalizes fragments', () => {
  assert.equal(assertPublicHttpUrl('https://example.com/jobs/1#details').toString(), 'https://example.com/jobs/1');
  assert.equal(assertPublicHttpUrl('http://example.com:80/jobs').hostname, 'example.com');
});

test('SSRF guard blocks local, private and credential URLs', () => {
  for (const value of [
    'http://localhost/admin',
    'http://127.0.0.1:8080/admin',
    'http://192.168.1.10/private',
    'http://169.254.169.254/latest/meta-data',
    'file:///etc/passwd',
    'https://user:password@example.com/private',
  ]) {
    assert.throws(() => assertPublicHttpUrl(value));
  }
});

test('research scores are bounded before persistence', () => {
  assert.equal(clampScore(120), 100);
  assert.equal(clampScore(-2), 0);
  assert.equal(clampScore('not-a-number'), null);
  assert.equal(clampConfidence(2), 1);
  assert.equal(clampConfidence(-1), 0);
});
