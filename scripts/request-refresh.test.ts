import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestRefresh } from '@/lib/request-refresh';

test('focus coalesces and mutation invalidations cause exactly one fresh read', async () => {
  const requests: Array<(value: number) => void> = []; const published: number[] = [];
  const request = createRequestRefresh(() => new Promise<number>(resolve => requests.push(resolve)), value => published.push(value), () => assert.fail('unexpected error'));
  const first = request.refresh();
  assert.equal(request.refresh(), first); assert.equal(requests.length, 1);
  request.refresh(true); request.refresh(true);
  requests[0](1); await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2); assert.deepEqual(published, []);
  requests[1](2); await first;
  assert.deepEqual(published, [2]); request.dispose();
});

test('disposing prevents late results and errors from publishing and aborts the fetch', async () => {
  let complete!: (value: number) => void; let signal!: AbortSignal;
  const request = createRequestRefresh(s => { signal = s; return new Promise<number>(resolve => { complete = resolve; }); }, () => assert.fail('stale value'), () => assert.fail('stale error'));
  const task = request.refresh(); request.dispose(); assert.equal(signal.aborted, true);
  complete(1); await task; await request.refresh();
});
