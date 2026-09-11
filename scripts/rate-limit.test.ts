import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeRateLimit, RateLimitError, resetRateLimitBucketsForTests } from '@/lib/rate-limit';

test('rate limit allows requests under the cap and blocks afterwards', () => {
  resetRateLimitBucketsForTests();
  consumeRateLimit('test:key', 2, 60_000);
  consumeRateLimit('test:key', 2, 60_000);
  assert.throws(() => consumeRateLimit('test:key', 2, 60_000), RateLimitError);
});

test('rate limit windows are isolated by key', () => {
  resetRateLimitBucketsForTests();
  consumeRateLimit('test:a', 1, 60_000);
  assert.doesNotThrow(() => consumeRateLimit('test:b', 1, 60_000));
  assert.throws(() => consumeRateLimit('test:a', 1, 60_000), RateLimitError);
});
