import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlanRestriction, interpolatePlanCopy, nextPlanTabIndex, quotaState, type QuotaBucketView } from '@/lib/plan-presentation';
import { consumeCvAiStream } from '@/lib/cv-ai-stream';

const bucket = (patch: Partial<QuotaBucketView> = {}): QuotaBucketView => ({ used: 0, reserved: 0, limit: 10, remaining: 10, resetAt: null, ...patch });

test('quota feedback includes work in flight and blocks at zero remaining', () => {
  assert.equal(quotaState(bucket({ used: 6, reserved: 1, remaining: 3 })), 'available');
  assert.equal(quotaState(bucket({ used: 6, reserved: 2, remaining: 2 })), 'warning');
  assert.equal(quotaState(bucket({ used: 8, reserved: 2, remaining: 0 })), 'exhausted');
  assert.equal(quotaState(bucket({ limit: 0, remaining: 0 })), 'exhausted');
});

test('plan failures open quota feedback, while ordinary rate limits and in-flight retries do not upsell', () => {
  assert.deepEqual(getPlanRestriction({ error: 'Quota exhausted', code: 'QUOTA_EXCEEDED', bucket: 'matching' }, 'match'), { code: 'QUOTA_EXCEEDED', bucket: 'matching', source: 'match', kind: 'quota' });
  assert.equal(getPlanRestriction({ error: { code: 'CV_READ_ONLY' } }, 'editor')?.code, 'CV_READ_ONLY');
  assert.equal(getPlanRestriction({ error: 'subscription_required' }, 'keys')?.code, 'SUBSCRIPTION_REQUIRED');
  assert.equal(getPlanRestriction({ code: 'OPERATION_IN_PROGRESS' }, 'editor')?.kind, 'progress');
  assert.equal(getPlanRestriction({ code: 'RATE_LIMITED' }, 'editor')?.kind, 'rate');
  assert.equal(getPlanRestriction({ code: 'PRO_REQUIRED' }, 'editor')?.kind, 'quota');
  assert.equal(getPlanRestriction({ code: 'MATCH_BATCH_TOO_LARGE', limit: 50 }, 'match')?.limit, 50);
});

test('copy interpolation preserves unknown variables for review and accepts a zero limit', () => {
  assert.equal(interpolatePlanCopy('{limit} actions · {unknown}', { limit: 0 }), '0 actions · {unknown}');
});

function responseFor(chunks: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close(); } }));
}

test('CV stream publishes only its confirmed destination and handles footer split across chunks', async () => {
  const text = '# CV\nExperiencia\n\n[METADATA:{"success":true,"cvId":"saved-version"}]';
  const observed: string[] = [];
  const result = await consumeCvAiStream(responseFor(Array.from(text)), value => observed.push(value));
  assert.deepEqual(result, { cvId: 'saved-version', content: '# CV\nExperiencia' });
  assert.ok(observed.every(value => !value.includes('[METADATA') && !value.includes('saved-version')));
});

test('disconnected or failed streams never become a successful new document', async () => {
  await assert.rejects(consumeCvAiStream(responseFor(['# Partial CV'])), /INCOMPLETE_AI_STREAM/);
  await assert.rejects(consumeCvAiStream(responseFor(['# Partial CV\n[ERROR:Generation failed]'])), /Generation failed/);
  await assert.rejects(consumeCvAiStream(responseFor(['# Partial CV\n[METADATA:{"success":false}]'])), /INCOMPLETE_AI_STREAM/);
});

test('admin tabs wrap on arrow keys and implement Home/End without intercepting other keys', () => {
  assert.equal(nextPlanTabIndex('ArrowLeft', 0), 2);
  assert.equal(nextPlanTabIndex('ArrowRight', 2), 0);
  assert.equal(nextPlanTabIndex('Home', 1), 0);
  assert.equal(nextPlanTabIndex('End', 0), 2);
  assert.equal(nextPlanTabIndex('Tab', 1), null);
});
