import test from 'node:test';
import assert from 'node:assert/strict';
import { errorEventValues, parseClientError, diagnosticRoute } from '@/lib/diagnostics-schema';
import { createErrorRecorder } from '@/lib/error-event-buffer';
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';

test('diagnostic payloads cannot store exception text, private URLs or forged header context', () => {
  const values = errorEventValues({ requestId: 'test-request-one', event: 'safe_event', code: 'SQL private', route: '/editor/private-email?token=secret', source: 'browser', message: 'CV private' } as never);
  assert.deepEqual(values, { requestId: 'test-request-one', event: 'safe_event', code: 'UNEXPECTED_ERROR', route: '/editor/:cvId', source: 'browser' });
  assert.equal(parseClientError({ code: 'UNEXPECTED_ERROR', step: 'page', message: 'private' }), null);
  assert.equal(parseClientError({ code: 'SELECT private', step: 'page' }), null);
  assert.equal(parseClientError({ code: 'UNEXPECTED_ERROR', step: 'private data' }), null);
  assert.equal(errorEventValues({ requestId: '\nprivate' }), null);
  assert.equal(diagnosticRoute('/api/cv/secret-cv-id/photo?content=private'), '/api/cv/:id/:action');
  const response = middleware(new NextRequest('http://localhost/editor/private-title', { headers: { 'x-request-id': 'x'.repeat(1000), 'x-matchply-route': '/forged-private' } }));
  assert.match(response.headers.get('x-request-id')!, /^[a-f0-9-]{36}$/);
  assert.equal(response.headers.get('x-middleware-request-x-matchply-route'), '/editor/:cvId');
});

test('error recording is bounded, non-blocking and backs off after storage failure', async () => {
  let now = 1000, writes = 0, enabled = true;
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const recorder = createErrorRecorder(async () => { writes++; await held; throw new Error('DB offline'); }, () => enabled, () => now);
  const event = { requestId: 'test-request-one', event: 'test_error', code: 'UNEXPECTED_ERROR', route: '/', source: 'server' as const };
  for (let i = 0; i < 20; i++) recorder.record(event);
  await Promise.resolve(); assert.equal(writes, 4);
  release(); await recorder.drain();
  recorder.record(event); await recorder.drain(); assert.equal(writes, 4);
  now += 60_001; recorder.record(event); await recorder.drain(); assert.equal(writes, 5);
  enabled = false; now += 60_001; recorder.record(event); await recorder.drain(); assert.equal(writes, 5);
});
