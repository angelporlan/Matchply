import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeCvOptimization, fetchOptimizationResponse } from '@/lib/cv-optimization/client';

const admitted = () => Response.json({ jobId: 'job-one', cvId: 'cv-one', requestId: 'request-one' }, { status: 202 });

test('optimization polling recovers a lost mobile connection without admitting another job', async t => {
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    calls.push(String(url));
    if (calls.length === 1) throw new TypeError('Failed to fetch');
    return Response.json({ status: 'completed', result: { optimizationId: 'optimization-one' } });
  });
  assert.deepEqual(await consumeCvOptimization(admitted()), { cvId: 'cv-one', optimizationId: 'optimization-one' });
  assert.deepEqual(calls, ['/api/ai/jobs/job-one', '/api/ai/jobs/job-one']);
});

test('failed jobs expose an actionable error without the provider secret and identify terminal failure', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ status: 'failed', lastError: 'Invalid API key sk-private', requestId: 'request-one' }));
  await assert.rejects(consumeCvOptimization(admitted()), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.doesNotMatch(error.message, /sk-private|API key/);
    assert.equal((error as Error & { terminal?: boolean }).terminal, true);
    return true;
  });
});

test('a lost POST response reuses its body and idempotency key', async t => {
  const requests: RequestInit[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    requests.push(init);
    if (requests.length === 1) return new Response(new ReadableStream({ start(controller) { controller.error(new TypeError('connection reset while reading')); } }), { status: 202 });
    return admitted();
  });
  const body = JSON.stringify({ requestId: 'request-one', jobDescription: 'Pasted offer' });
  const response = await fetchOptimizationResponse('/api/ai/optimize', { method: 'POST', body, headers: { 'Idempotency-Key': 'request-one' } });
  assert.equal((await response.json()).jobId, 'job-one');
  assert.equal(requests.length, 2);
  for (const request of requests) { assert.equal(request.body, body); assert.equal(new Headers(request.headers).get('Idempotency-Key'), 'request-one'); }
});

test('recovery stops after two retries and hides raw network or gateway messages', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('upstream provider sk-private', { status: 503 }); });
  await assert.rejects(fetchOptimizationResponse('/api/ai/jobs/job-one'), error => {
    assert.ok(error instanceof Error); assert.match(error.message, /Reintentar/); assert.doesNotMatch(error.message, /sk-private|provider/); return true;
  });
  assert.equal(calls, 3);
});

test('authorization and input errors are not retried', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json({ code: 'AUTH_REQUIRED' }, { status: 401 }); });
  assert.equal((await fetchOptimizationResponse('/api/ai/optimize')).status, 401);
  assert.equal(calls, 1);
});

test('cancelling during backoff prevents another request', async t => {
  const controller = new AbortController(); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; setTimeout(() => controller.abort(), 10); throw new TypeError('offline'); });
  await assert.rejects(fetchOptimizationResponse('/api/ai/jobs/job-one', { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
