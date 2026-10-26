import test from 'node:test';
import assert from 'node:assert/strict';
import { createCvAiCaller } from '@/lib/cv-optimization/provider';
import { CvOptimizationError } from '@/lib/cv-optimization/validation';
import type { AiModelRef } from '@/lib/ai-runtime-config';

const primary: AiModelRef = { provider: 'openai', model: 'primary-model' };
const secondary: AiModelRef = { provider: 'openrouter', model: 'secondary-model' };
const complete = (content = '# Backup CV') => Response.json({ choices: [{ message: { content }, finish_reason: 'stop' }] });
type Stat = { provider: string; success: boolean; errorCode?: string | null };
const args = (signal = new AbortController().signal) => [primary, 'System instructions', 'Synthetic CV and offer', 0.4, signal, 'optimize_adapted', 'free'] as const;

test('authentication failure uses one secondary provider and never retains its raw body', async () => {
  const calls: Array<{ url: string; body: string; authorization: string | null }> = [], stats: Stat[] = [];
  const call = createCvAiCaller({
    env: { OPENAI_API_KEY: ' primary-key ', OPENROUTER_API_KEY: 'secondary-key' },
    fallback: async () => secondary, record: stat => { stats.push(stat); },
    request: async (url, init) => {
      calls.push({ url, body: String(init?.body), authorization: new Headers(init?.headers).get('Authorization') });
      return calls.length === 1 ? new Response('Incorrect API key sk-private', { status: 401 }) : complete();
    },
  });
  assert.equal(await call(...args()), '# Backup CV');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].authorization, 'Bearer primary-key');
  assert.deepEqual(JSON.parse(calls[0].body).messages, JSON.parse(calls[1].body).messages);
  assert.deepEqual(stats.map(s => [s.provider, s.success, s.errorCode]), [['openai', false, 'AI_HTTP_401'], ['openrouter', true, undefined]]);
  assert.doesNotMatch(JSON.stringify(stats), /sk-private/);
});

test('a missing primary credential can recover, while an unconfigured secondary is never called', async () => {
  let calls = 0;
  const call = createCvAiCaller({ env: { OPENROUTER_API_KEY: 'secondary-key' }, fallback: async () => secondary,
    record: () => {}, request: async () => { calls++; return complete(); } });
  assert.equal(await call(...args()), '# Backup CV'); assert.equal(calls, 1);
  const unavailable = createCvAiCaller({ env: { OPENROUTER_API_KEY: 'mock-key' }, fallback: async () => secondary,
    record: () => {}, request: async () => { throw new Error('must not call an unconfigured provider'); } });
  await assert.rejects(unavailable(...args()), { code: 'AI_NOT_CONFIGURED' });
});

test('fallback exhaustion is bounded to two provider attempts', async () => {
  let calls = 0;
  const call = createCvAiCaller({ env: { OPENAI_API_KEY: 'primary-key', OPENROUTER_API_KEY: 'secondary-key' },
    fallback: async () => secondary, record: () => {}, request: async () => { calls++; return new Response('private provider detail', { status: 503 }); } });
  await assert.rejects(call(...args()), { code: 'AI_HTTP_503' }); assert.equal(calls, 2);
});

test('worker cancellation never starts a fallback request', async () => {
  const controller = new AbortController(); let fallbackReads = 0;
  const call = createCvAiCaller({ env: { OPENAI_API_KEY: 'primary-key', OPENROUTER_API_KEY: 'secondary-key' },
    fallback: async () => { fallbackReads++; return secondary; }, record: () => {},
    request: async () => { controller.abort(); throw new DOMException('Aborted', 'AbortError'); } });
  await assert.rejects(call(...args(controller.signal)), { code: 'AI_CANCELLED' }); assert.equal(fallbackReads, 0);
});

test('a failed provider preview is cleared before streaming the secondary result', async () => {
  const previews: string[] = []; let calls = 0;
  const event = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
  const call = createCvAiCaller({ env: { OPENAI_API_KEY: 'primary-key', OPENROUTER_API_KEY: 'secondary-key' },
    fallback: async () => secondary, record: () => {}, request: async () => {
      calls++;
      const body = calls === 1 ? event({ choices: [{ delta: { content: '# Partial' } }] }) + event({ error: { message: 'secret upstream detail' } })
        : event({ choices: [{ delta: { content: '# Backup CV' }, finish_reason: 'stop' }] });
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
    } });
  assert.equal(await call(...args(), async content => { previews.push(content); }), '# Backup CV');
  assert.deepEqual(previews, ['# Partial', '', '# Backup CV']);
});

test('lost publication ownership prevents fallback generation', async () => {
  let calls = 0;
  const call = createCvAiCaller({ env: { OPENAI_API_KEY: 'primary-key', OPENROUTER_API_KEY: 'secondary-key' },
    fallback: async () => secondary, record: () => {}, request: async () => {
      calls++; return new Response('data: {"choices":[{"delta":{"content":"# CV"},"finish_reason":"stop"}]}\n\n');
    } });
  await assert.rejects(call(...args(), async () => { throw new CvOptimizationError('OPTIMIZATION_LEASE_LOST'); }), { code: 'OPTIMIZATION_LEASE_LOST' });
  assert.equal(calls, 1);
});

test('the timeout covers a stalled response body and can recover on the secondary', async () => {
  let calls = 0; const stats: Stat[] = [];
  const call = createCvAiCaller({ env: { OPENAI_API_KEY: 'primary-key', OPENROUTER_API_KEY: 'secondary-key' }, timeoutMs: 15,
    fallback: async () => secondary, record: stat => { stats.push(stat); }, request: async (_url, init) => {
      if (++calls > 1) return complete();
      return new Response(new ReadableStream({ start(controller) {
        init?.signal?.addEventListener('abort', () => controller.error(new DOMException('Timed out', 'AbortError')), { once: true });
      } }));
    } });
  assert.equal(await call(...args()), '# Backup CV');
  assert.equal(stats[0].errorCode, 'AI_TIMEOUT'); assert.equal(calls, 2);
});
