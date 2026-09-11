import test from 'node:test';
import assert from 'node:assert/strict';
import { log } from '@/lib/logger';

test('log emits a single JSON object with event, level and serialized errors', () => {
  const lines: string[] = [];
  const original = console.info;
  console.info = (message?: unknown) => {
    if (typeof message === 'string') lines.push(message);
  };
  try {
    log({ event: 'test_event', userId: 'u1', durationMs: 12, error: new Error('boom') });
  } finally {
    console.info = original;
  }

  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]);
  assert.equal(payload.event, 'test_event');
  assert.equal(payload.level, 'info');
  assert.equal(payload.userId, 'u1');
  assert.equal(payload.durationMs, 12);
  assert.equal(payload.error.message, 'boom');
  assert.equal(typeof payload.ts, 'string');
});
