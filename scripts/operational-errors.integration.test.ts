import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.OPERATIONAL_ERRORS_TEST_DATABASE_URL;
test('error index correlates logs without storing technical data and expires only old records', { skip: !database }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(database!).hostname) && new URL(database!).pathname.includes('test'));
  process.env.DATABASE_URL = database; process.env.ERROR_EVENTS_ENABLED = 'true';
  const { db, pool } = await import('@/db');
  const { operationalErrors } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { recordErrorEvent, listOperationalErrors, cleanupOperationalErrors } = await import('@/lib/error-events');
  const { log, errorRecorder } = await import('@/lib/logger');
  const ids = [randomUUID(), randomUUID(), randomUUID()], traceId = randomUUID();
  const consoleError = console.error;
  const output: string[] = []; console.error = value => { output.push(String(value)); };
  try {
    log({ event: 'integration_failure', requestId: ids[0], level: 'error', route: '/editor/private-cv-title', error: new Error('PRIVATE_SQL_CANARY SELECT secret') });
    await errorRecorder.drain();
    const result = await listOperationalErrors(ids[0]); assert.equal(result.total, 1);
    assert.equal(result.rows[0].route, '/editor/:cvId');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SQL_CANARY|SELECT|private-cv-title/);
    const line = output.map(value => JSON.parse(value)).find(value => value.event === 'integration_failure');
    assert.equal(line.requestId, ids[0]); assert.match(line.error.message, /PRIVATE_SQL_CANARY/); assert.ok(line.error.stack);
    await recordErrorEvent({ requestId: ids[1], traceId, event: 'test_browser_error', code: 'NETWORK_ERROR', route: '/try', source: 'browser', digest: '123' });
    assert.equal((await listOperationalErrors(traceId)).rows[0].requestId, ids[1]);
    assert.equal((await listOperationalErrors('123')).rows[0].requestId, ids[1]);
    assert.equal((await listOperationalErrors("'; SELECT private")).total, 0);
    await recordErrorEvent({ requestId: ids[2], event: 'expired_fixture', code: 'UNEXPECTED_ERROR', route: '/', source: 'server' });
    await db.update(operationalErrors).set({ createdAt: new Date(Date.now() - 31 * 86400_000) }).where(eq(operationalErrors.requestId, ids[2]));
    await cleanupOperationalErrors();
    assert.equal((await db.select().from(operationalErrors).where(eq(operationalErrors.requestId, ids[2]))).length, 0);
    assert.equal((await listOperationalErrors(ids[0])).total, 1);
  } finally {
    console.error = consoleError; process.env.ERROR_EVENTS_ENABLED = 'false'; await errorRecorder.drain();
    await db.delete(operationalErrors).where(inArray(operationalErrors.requestId, ids)); await pool.end();
  }
});
