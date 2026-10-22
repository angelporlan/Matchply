import test from 'node:test';
import assert from 'node:assert/strict';
import { startSerialPoll } from '@/lib/serial-poll';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('slow polling is serialized and disposal aborts the pending read and stops future reads', { timeout: 2_000 }, async () => {
  const calls: Array<{ signal: AbortSignal; resolve: () => void }> = [];
  const stop = startSerialPoll(signal => new Promise<void>(resolve => calls.push({ signal, resolve })), 1);
  try {
    await wait(20); assert.equal(calls.length, 1);
    calls[0].resolve(); await wait(20); assert.equal(calls.length, 2);
    stop(); assert.equal(calls[1].signal.aborted, true);
    calls[1].resolve(); await wait(20); assert.equal(calls.length, 2);
  } finally { stop(); }
});

test('transient polling failures retry and stopping before the first tick performs no read', { timeout: 2_000 }, async () => {
  let calls = 0;
  const stopBefore = startSerialPoll(async () => { calls++; }, 10);
  stopBefore(); await wait(20); assert.equal(calls, 0);
  let retry!: () => void;
  const retried = new Promise<void>(resolve => { retry = resolve; });
  const stop = startSerialPoll(async () => { if (++calls === 2) retry(); throw new Error('temporary'); }, 1);
  try { await retried; assert.equal(calls, 2); }
  finally { stop(); }
});
