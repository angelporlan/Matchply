import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const testUrl = process.env.OFFER_IMPORT_TEST_DATABASE_URL;
test('offer queue deduplicates, isolates actors, bounds retries and rejects obsolete leases', { skip: !testUrl }, async t => {
  const url = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { aiJobs, users } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const queue = await import('@/lib/ai-jobs/queue');
  const userIds = [randomUUID(), randomUUID()];
  const offerUrl = 'https://www.linkedin.com/jobs/view/4465816694/';
  const create = (userId = userIds[0], requestId = randomUUID(), url = offerUrl) =>
    queue.enqueueImportOfferJob(userId, { requestId, url }, userId);
  await db.insert(users).values(userIds.map(id => ({ id, email: `offer-import-${id}@example.test` })));
  try {
    await t.test('two simultaneous requests enqueue one job; another actor cannot read it', async () => {
      const requestId = randomUUID();
      const [a, b] = await Promise.all([create(userIds[0], requestId), create(userIds[0], requestId)]);
      assert.equal(a.id, b.id);
      assert.equal(await queue.getAiJobForUser(userIds[1], a.id), null);
      await assert.rejects(create(userIds[0], requestId, 'https://www.linkedin.com/jobs/view/999/'), /OFFER_REQUEST_CONFLICT/);
      const claimed = await queue.claimAiJobById(a.id);
      assert.ok(claimed);
      assert.equal(await queue.completeAiJob(a.id, {}), undefined);
      await queue.completeAiJob(a.id, {}, claimed);
    });
    await t.test('expired and superseded attempts cannot update progress, fail or complete', async () => {
      const job = await create();
      const old = await queue.claimAiJobById(job.id);
      assert.ok(old);
      await db.update(aiJobs).set({ leaseUntil: new Date(0) }).where(eq(aiJobs.id, job.id));
      assert.equal(await queue.completeAiJob(job.id, {}, old), undefined);
      const current = await queue.claimAiJobById(job.id);
      assert.ok(current);
      assert.equal(current.attempt, 2);
      assert.equal(await queue.saveAiJobProgress(old, { stage: 'structuring' }), false);
      assert.equal(await queue.failAiJob(old, new Error('late failure')), undefined);
      assert.equal(await queue.renewAiJobLease(old), false);
      await queue.completeAiJob(job.id, {}, current);
    });
    await t.test('only transient errors retry, with at most three attempts', async () => {
      const { OfferImportError } = await import('@/lib/offer-import/service');
      const permanent = await create();
      const claimed = await queue.claimAiJobById(permanent.id);
      assert.ok(claimed);
      await queue.failAiJob(claimed, new OfferImportError('OFFER_AI_NOT_CONFIGURED'));
      assert.equal((await queue.getAiJob(permanent.id))?.status, 'failed');
      const transient = await create();
      for (let attempt = 1; attempt <= 3; attempt++) {
        const owner = await queue.claimAiJobById(transient.id);
        assert.ok(owner);
        assert.equal(owner.attempt, attempt);
        await queue.failAiJob(owner, new OfferImportError('OFFER_AI_HTTP_429', true));
        const updated = await queue.getAiJob(transient.id);
        assert.equal(updated?.status, attempt < 3 ? 'queued' : 'failed');
        if (attempt < 3) await db.update(aiJobs).set({ nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, transient.id));
      }
      assert.equal(await queue.claimAiJobById(transient.id), null);
    });
  } finally {
    await db.delete(users).where(inArray(users.id, userIds));
    await pool.end();
  }
});
