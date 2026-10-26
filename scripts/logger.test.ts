import test from 'node:test';
import assert from 'node:assert/strict';
import { log } from '@/lib/logger';
import { withAiUsageContext } from '@/lib/ai-usage-context';

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

test('worker failures inherit the admission request ID without depending on HTTP headers', async () => {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (line?: unknown) => { if (typeof line === 'string') lines.push(line); };
  try {
    await withAiUsageContext({ requestId: 'admission-one', jobId: 'job-one', functionKey: 'optimize_cv_variants' }, async () => {
      await Promise.resolve();
      log({ event: 'cv_ai_request_failed', level: 'warn', errorCode: 'AI_TIMEOUT', provider: 'openai' });
    });
  } finally { console.warn = original; }
  assert.equal(JSON.parse(lines[0]).requestId, 'admission-one');
  assert.equal(JSON.parse(lines[0]).errorCode, 'AI_TIMEOUT');
});
