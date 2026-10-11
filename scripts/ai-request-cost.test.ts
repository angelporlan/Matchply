import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRequestCost, readTokenUsage } from '@/lib/ai-request-cost';
import { observeAiResponse } from '@/lib/ai-usage-fetch';
import { getAiUsageContext, withAiUsageContext } from '@/lib/ai-usage-context';
import { parseUsageReportFilters } from '@/lib/ai-usage-report';
import type { AiRequestMetric } from '@/lib/ai-request-usage';

const close = (actual: number | null, expected: number) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-10, `${actual} !== ${expected}`);
test('Decisions bills all input once, without cache-write or output charges', () => {
  const usage = readTokenUsage({ usage: { input_tokens: 100_000, output_tokens: 2_000, input_tokens_details: { cached_tokens: 40_000, cache_write_tokens: 10_000 } } });
  const cost = calculateRequestCost('openai', 'gpt-6-luna', 'decisions', usage);
  close(cost.costUsd, .01); assert.equal(cost.costSource, 'estimated');
  close(calculateRequestCost('openai', 'gpt-6-luna', 'decisions', { ...usage, inputTokens: 300_000 }).costUsd, .06);
});
test('Responses bills uncached, cached and written input separately and includes web tools', () => {
  const usage = readTokenUsage({ usage: { input_tokens: 100_000, output_tokens: 10_000, input_tokens_details: { cached_tokens: 40_000, cache_write_tokens: 10_000 }, output_tokens_details: { reasoning_tokens: 4_000 } }, output: [{ type: 'web_search_call' }, { type: 'web_search_call' }, { type: 'message' }] });
  assert.equal(usage.outputTokens, 10_000); assert.equal(usage.reasoningTokens, 4_000);
  close(calculateRequestCost('openai', 'gpt-6-luna', 'responses', usage).costUsd, .03165);
  close(calculateRequestCost('openai', 'gpt-6-luna', 'responses', { ...usage, webSearchCalls: 0 }, 'flex').costUsd, .005825);
});
test('Gemini adds thinking to candidates once and reads cached input', () => {
  const usage = readTokenUsage({ usageMetadata: { promptTokenCount: 1_000, candidatesTokenCount: 200, thoughtsTokenCount: 100, cachedContentTokenCount: 400 } });
  assert.equal(usage.outputTokens, 300); assert.equal(usage.cachedInputTokens, 400);
  close(calculateRequestCost('gemini', 'gemini-2.5-flash', 'generateContent', usage).costUsd, .000942);
});
test('reported OpenRouter cost includes zero and wins over estimates', () => {
  const usage = readTokenUsage({ usage: { cost: .123, prompt_tokens: 900, completion_tokens: 200 } });
  const cost = calculateRequestCost('openrouter', 'any/new-model', 'chat/completions', usage);
  assert.equal(cost.costUsd, .123); assert.equal(cost.costSource, 'reported');
  assert.equal(calculateRequestCost('openrouter', 'openrouter/free', 'chat/completions', { ...usage, reportedCostUsd: 0 }).costUsd, 0);
});
test('missing usage, unknown prices and invalid cache totals remain unknown, never zero', () => {
  const usage = readTokenUsage({ usage: { prompt_tokens: 100, completion_tokens: 20 } });
  for (const cost of [calculateRequestCost('openai', 'new-model', 'responses', usage), calculateRequestCost('openai', 'gpt-6-luna', 'responses', readTokenUsage(null)), calculateRequestCost('openai', 'gpt-6-luna', 'responses', { ...usage, cachedInputTokens: 101 })]) {
    assert.equal(cost.costUsd, null); assert.equal(cost.costSource, 'unknown');
  }
  assert.equal(calculateRequestCost('openai', 'gpt-4o-2024-05-13', 'chat/completions', usage).costUsd, null);
  assert.equal(readTokenUsage({ usage: { input_tokens: -1, output_tokens: '200', cost: -1 } }).inputTokens, null);
});
test('parallel users and nested functions retain separate request attribution', async () => {
  await Promise.all(['one', 'two'].map(async userId => withAiUsageContext({ userId, jobId: `${userId}-job`, functionKey: 'match_batch' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 3));
    assert.equal(getAiUsageContext()?.userId, userId);
    withAiUsageContext({ functionKey: 'import_offer' }, () => {
      assert.deepEqual(getAiUsageContext(), { userId, jobId: `${userId}-job`, functionKey: 'import_offer' });
    });
    assert.equal(getAiUsageContext()?.functionKey, 'match_batch');
  })));
  assert.equal(getAiUsageContext(), undefined);
});
const meta = { functionKey: 'match_batch', userId: 'fixture-user', provider: 'openai', model: 'gpt-6-luna', endpoint: 'decisions' };
test('JSON accounting preserves bytes, headers and status and records a physical request once', async () => {
  const metrics: AiRequestMetric[] = [];
  const text = JSON.stringify({ id: 'provider-id', answers: [], usage: { input_tokens: 123, output_tokens: 0 } });
  const response = observeAiResponse(new Response(text, { headers: { 'content-type': 'application/json', 'x-request-id': 'request-id' } }), meta, Date.now(), m => metrics.push(m));
  assert.equal(await response.text(), text); assert.equal(metrics.length, 1);
  assert.equal(metrics[0].inputTokens, 123); assert.equal(metrics[0].providerRequestId, 'request-id');
  assert.equal(metrics[0].userId, 'fixture-user'); assert.equal(metrics[0].success, true);
  assert.ok(!JSON.stringify(metrics).includes('answers'));
});
test('SSE usage survives UTF-8 and event boundaries without summing cumulative chunks', async () => {
  const metrics: AiRequestMetric[] = [];
  const text = 'data: {"choices":[{"delta":{"content":"España"}}]}\r\n\r\ndata: {"usage":{"prompt_tokens":100,"completion_tokens":20}}\n\ndata: {"usage":{"prompt_tokens":100,"completion_tokens":30}}\r\n\r\ndata: [DONE]\n\n';
  const bytes = new TextEncoder().encode(text); let cursor = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(c) { if (cursor >= bytes.length) return c.close(); c.enqueue(bytes.slice(cursor, cursor += 3)); } });
  const response = observeAiResponse(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }), { ...meta, endpoint: 'chat/completions' }, Date.now(), m => metrics.push(m));
  assert.equal(await response.text(), text); assert.equal(metrics.length, 1);
  assert.equal(metrics[0].inputTokens, 100); assert.equal(metrics[0].outputTokens, 30);
});
test('HTTP errors, unreadable bodies and cancellations record failures without fictional usage', async () => {
  const metrics: AiRequestMetric[] = []; const record = (m: AiRequestMetric) => metrics.push(m);
  const error = observeAiResponse(new Response('private error', { status: 429 }), meta, Date.now(), record);
  assert.equal(await error.text(), 'private error'); assert.equal(metrics[0].errorCode, 'HTTP_429');
  assert.equal(metrics[0].inputTokens, null);
  const failed = new ReadableStream<Uint8Array>({ pull(c) { c.error(new Error('connection lost')); } });
  await assert.rejects(observeAiResponse(new Response(failed), meta, Date.now(), record).text(), /connection lost/);
  const stream = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new TextEncoder().encode('data: {}\n\n')); } });
  await observeAiResponse(new Response(stream, { headers: { 'content-type': 'text/event-stream' } }), meta, Date.now(), record).body!.cancel();
  assert.equal(metrics.length, 3); assert.ok(metrics.every(m => !m.success));
  assert.equal(metrics[2].errorCode, 'CANCELLED');
});
test('admin filters reject malformed IDs and bound periods, searches and pagination', () => {
  const filters = parseUsageReportFilters({ days: '10000', user: 'not-uuid', function: '<script>', usersPage: '-4', requestsPage: '99999', q: 'x'.repeat(300) });
  assert.equal(filters.days, 30); assert.equal(filters.userId, undefined); assert.equal(filters.functionKey, undefined);
  assert.equal(filters.userPage, 1); assert.equal(filters.requestPage, 10000); assert.equal(filters.query?.length, 100);
});
