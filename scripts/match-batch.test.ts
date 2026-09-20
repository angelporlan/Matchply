import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addMatchBatchError, addMatchBatchScore, matchBatchCounts, pendingMatchOfferIds, readMatchBatchResult,
} from '@/lib/ai-jobs/match-batch-state';

test('batch progress preserves valid zero scores and retries only unsaved offers', () => {
  let progress = readMatchBatchResult(null, 3);
  progress = addMatchBatchScore(progress, { id: 'zero', score: 0 });
  progress = addMatchBatchScore(progress, { id: 'high', score: 80 });
  progress = addMatchBatchError(progress, { id: 'pending', message: 'Respuesta incompleta' });
  const restored = readMatchBatchResult(JSON.parse(JSON.stringify(progress)));
  assert.deepEqual(pendingMatchOfferIds(['zero', 'high', 'pending', 'pending'], restored), ['pending']);
  assert.deepEqual(matchBatchCounts(restored), { total: 3, evaluated: 2, failed: 1, kept: 1, archived: 1 });
  assert.deepEqual(restored.items, [{ id: 'zero', score: 0 }, { id: 'high', score: 80 }]);
});

test('successful retry removes its failure and never creates missing scores', () => {
  let progress = readMatchBatchResult({ total: 2, items: [{ id: 'a', score: 70 }], errors: [{ id: 'b', message: 'Error' }] });
  assert.equal(progress.items.length, 1);
  progress = addMatchBatchScore(progress, { id: 'b', score: 42 });
  progress = addMatchBatchError(progress, { id: 'b', message: 'Late obsolete failure' });
  assert.equal(progress.errors.length, 0);
  assert.deepEqual(pendingMatchOfferIds(['a', 'b'], progress), []);
});

test('public batch progress discards invalid scores and narrative fields', () => {
  const progress = readMatchBatchResult({ total: 3, items: [
    { id: 'a', score: 0, reason: 'private narrative' }, { id: 'b', score: '50' }, { id: 'c', score: null },
    { id: 'd', score: Infinity }, { id: 'e', score: 101 },
  ] });
  assert.deepEqual(progress.items, [{ id: 'a', score: 0 }]);
  assert.throws(() => addMatchBatchScore(progress, { id: 'b', score: NaN }), /INVALID_MATCH_SCORE/);
});

const testUrl = process.env.MATCH_BATCH_TEST_DATABASE_URL;

test('durable match queue enforces lease ownership, recovery, and user isolation', { skip: !testUrl }, async t => {
  const url = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.pathname.includes('test'), 'Use an isolated local test database');
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users, aiJobs, jobOffers } = await import('@/db/schema');
  const { and, eq, inArray } = await import('drizzle-orm');
  const queue = await import('@/lib/ai-jobs/queue');
  const userIds = [randomUUID(), randomUUID()];
  await db.insert(users).values(userIds.map(id => ({ id, email: `batch-${id}@example.test` })));
  const create = (userId: string, requestId = randomUUID()) => queue.enqueueMatchBatchJob(userId, {
    requestId, offerIds: ['zero', 'pending'], targetThreshold: 65,
  });
  try {
    await t.test('a lost response can be retried without duplicating its job', async () => {
      const requestId = randomUUID();
      const [a, b] = await Promise.all([create(userIds[0], requestId), create(userIds[0], requestId)]);
      assert.equal(a.id, b.id);
      assert.equal(await queue.getAiJobForUser(userIds[1], a.id), null);
      const claimed = await queue.claimAiJobById(a.id);
      assert.ok(claimed);
      assert.equal(await queue.completeAiJob(a.id, {}), undefined, 'new match jobs require an ownership token');
      assert.ok(await queue.completeAiJob(a.id, { total: 0, items: [], errors: [] }, claimed));
    });
    await t.test('concurrent claims enforce one active job per user', async () => {
      const first = await create(userIds[0]);
      const second = await create(userIds[0]);
      const claims = await Promise.all([queue.claimAiJobById(first.id), queue.claimAiJobById(second.id)]);
      assert.equal(claims.filter(Boolean).length, 1);
      const active = claims.find(Boolean)!;
      const otherUserJob = await create(userIds[1]);
      const otherActive = await queue.claimAiJobById(otherUserJob.id);
      assert.ok(otherActive, 'another user remains eligible while a long batch runs');
      await queue.completeAiJob(active.id, {}, active);
      await queue.completeAiJob(otherActive.id, {}, otherActive);
      const waiting = claims[0] ? second : first;
      const next = await queue.claimAiJobById(waiting.id);
      assert.ok(next);
      await queue.completeAiJob(next.id, {}, next);
    });
    await t.test('partial zero survives retries; stale attempts cannot write or terminate the new owner', async () => {
      const job = await create(userIds[0]);
      const first = await queue.claimAiJobById(job.id);
      assert.ok(first);
      const partial = { total: 2, items: [{ id: 'zero', score: 0 }], errors: [{ id: 'pending', message: 'Retry' }] };
      assert.equal(await queue.saveAiJobProgress(first, partial), true);
      await queue.failAiJob(first, new Error('RETRY_TEST'));
      await db.update(aiJobs).set({ nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, job.id));
      const second = await queue.claimAiJobById(job.id);
      assert.ok(second);
      assert.equal(second.attempt, first.attempt + 1);
      assert.deepEqual(pendingMatchOfferIds(['zero', 'pending'], readMatchBatchResult(second.result)), ['pending']);
      assert.equal(await queue.renewAiJobLease(first), false);
      assert.equal(await queue.saveAiJobProgress(first, { items: [] }), false);
      assert.equal(await queue.failAiJob(first, new Error('LATE_FAILURE')), undefined);
      assert.equal(await queue.completeAiJob(first.id, {}, first), undefined);
      assert.equal(await queue.renewAiJobLease(second), true);
      assert.equal((await queue.getAiJob(job.id))?.status, 'running');
      assert.ok(await queue.completeAiJob(second.id, partial, second));
    });
    await t.test('worker scans past a busy user and recovers expired final attempts', async () => {
      const activeJob = await create(userIds[0]);
      const active = await queue.claimAiJobById(activeJob.id);
      assert.ok(active);
      const waiting = await create(userIds[0]);
      const eligible = await create(userIds[1]);
      await db.update(aiJobs).set({ createdAt: new Date('2000-01-01T00:00:00Z') }).where(eq(aiJobs.id, waiting.id));
      await db.update(aiJobs).set({ createdAt: new Date('2000-01-02T00:00:00Z') }).where(eq(aiJobs.id, eligible.id));
      const claimed = await queue.claimNextAiJob();
      assert.equal(claimed?.id, eligible.id);
      assert.ok(claimed);
      await queue.completeAiJob(claimed.id, {}, claimed);
      await queue.completeAiJob(active.id, {}, active);
      const exhausted = await queue.claimAiJobById(waiting.id);
      assert.ok(exhausted);
      await db.update(aiJobs).set({ attempt: 3, leaseUntil: new Date(0) }).where(eq(aiJobs.id, exhausted.id));
      const sentinel = await create(userIds[1]);
      await db.update(aiJobs).set({ createdAt: new Date('1999-01-01T00:00:00Z') }).where(eq(aiJobs.id, sentinel.id));
      const next = await queue.claimNextAiJob();
      assert.equal(next?.id, sentinel.id);
      assert.equal((await queue.getAiJob(exhausted.id))?.status, 'failed');
      assert.ok(next);
      await queue.completeAiJob(next.id, {}, next);
    });
    await t.test('worker persists each real score before publishing and retries only failed offers', async workerTest => {
      const { AIService } = await import('@/lib/ai-service');
      const { MATCH_DIMENSION_KEYS } = await import('@/lib/matching');
      const { processAiJob } = await import('@/lib/ai-jobs/process');
      const profile = { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 };
      await db.update(users).set({ careerProfile: profile, subscriptionStatus: 'active' }).where(eq(users.id, userIds[0]));
      const ids = [randomUUID(), randomUUID()];
      await db.insert(jobOffers).values(ids.map(id => ({ id, userId: userIds[0], title: 'Frontend', company: 'Queue fixture',
        description: 'Requirements\nReact is required for building customer interfaces.', scoreOverall: 83, status: 'interested' })));
      const job = await queue.enqueueMatchBatchJob(userIds[0], { requestId: randomUUID(), offerIds: ids, targetThreshold: 65 });
      const claimed = await queue.claimAiJobById(job.id);
      assert.ok(claimed);
      workerTest.mock.method(AIService as any, 'getSetting', async (key: string) => key.endsWith('provider') ? 'gemini' : 'queue-test');
      const prompts: string[] = [];
      workerTest.mock.method(AIService as any, 'callMatchText', async (_provider: string, _model: string, _system: string, userPrompt: string) => {
        prompts.push(userPrompt);
        const index = prompts.length === 1 ? 0 : 1;
        return JSON.stringify({ curated: [{ id: ids[index], ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, index === 0 ? 0 : 90])),
          requirements: [{ id: 'r1', name: 'React', kind: 'skill', importance: 'required', core: true, status: 'met',
            offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' },
            candidateEvidence: [{ sourceId: 'profile', quote: 'React' }], alternatives: [] }] }] });
      });
      await processAiJob(claimed);
      const partialJob = await queue.getAiJob(job.id);
      assert.equal(partialJob?.status, 'queued');
      assert.deepEqual(readMatchBatchResult(partialJob?.result).items, [{ id: ids[0], score: 0 }]);
      const firstRows = await db.select({ id: jobOffers.id, score: jobOffers.scoreOverall, status: jobOffers.status })
        .from(jobOffers).where(inArray(jobOffers.id, ids));
      assert.equal(firstRows.find(row => row.id === ids[0])?.score, 0);
      assert.equal(firstRows.find(row => row.id === ids[1])?.score, 83, 'failure must preserve the previous real score');
      assert.ok(firstRows.every(row => row.status === 'interested'), 'matching never moves applications');
      await db.update(aiJobs).set({ nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, job.id));
      const retry = await queue.claimAiJobById(job.id);
      assert.ok(retry);
      await processAiJob(retry);
      assert.equal(prompts.length, 2);
      assert.ok(prompts[1].includes(ids[1]));
      assert.ok(!prompts[1].includes(ids[0]), 'saved siblings must not be sent to the model again');
      const done = await queue.getAiJob(job.id);
      assert.equal(done?.status, 'completed');
      assert.deepEqual(readMatchBatchResult(done?.result).items, [{ id: ids[0], score: 0 }, { id: ids[1], score: 90 }]);
      assert.equal(readMatchBatchResult(done?.result).errors.length, 0);
      const { readCurrentMatchBatchResult } = await import('@/lib/ai-jobs/match-batch-progress');
      assert.ok(done);
      const fresh = await readCurrentMatchBatchResult(done);
      assert.equal(fresh.items.length, 2);
      assert.equal('inputHashes' in fresh, false, 'private validation metadata must not reach GET or NDJSON');
      await db.update(jobOffers).set({ company: 'Changed company' }).where(eq(jobOffers.id, ids[0]));
      const changedOffer = await readCurrentMatchBatchResult(done);
      assert.deepEqual(changedOffer.items, [{ id: ids[1], score: 90 }]);
      assert.equal(changedOffer.errors.find(error => error.id === ids[0])?.code, 'outdated');
      await db.update(users).set({ careerProfile: { ...profile, experienceYears: 4 } }).where(eq(users.id, userIds[0]));
      const changedProfile = await readCurrentMatchBatchResult(done);
      assert.equal(changedProfile.items.length, 0, 'completed job history must not replay scores invalidated by a profile edit');
      assert.ok(changedProfile.errors.every(error => error.code === 'outdated'));
    });
    await t.test('a partial success invalidated before retry is sent for evaluation again', async workerTest => {
      const { AIService } = await import('@/lib/ai-service');
      const { MATCH_DIMENSION_KEYS } = await import('@/lib/matching');
      const { processAiJob } = await import('@/lib/ai-jobs/process');
      const profile = { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 };
      await db.update(users).set({ careerProfile: profile, subscriptionStatus: 'active' }).where(eq(users.id, userIds[0]));
      const ids = [randomUUID(), randomUUID()];
      await db.insert(jobOffers).values(ids.map(id => ({ id, userId: userIds[0], title: 'Frontend', company: 'Before edit',
        description: 'Requirements\nReact is required for building customer interfaces.', scoreOverall: 83 })));
      const job = await queue.enqueueMatchBatchJob(userIds[0], { requestId: randomUUID(), offerIds: ids, targetThreshold: 65 });
      const claimed = await queue.claimAiJobById(job.id);
      assert.ok(claimed);
      workerTest.mock.method(AIService as any, 'getSetting', async () => 'queue-test');
      const prompts: string[] = [];
      workerTest.mock.method(AIService as any, 'callMatchText', async (_provider: string, _model: string, _system: string, userPrompt: string) => {
        prompts.push(userPrompt);
        const evaluatedIds = prompts.length === 1 ? ids.slice(0, 1) : ids;
        return JSON.stringify({ curated: evaluatedIds.map(id => ({ id, ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, 70])),
          requirements: [{ id: 'r1', name: 'React', kind: 'skill', importance: 'required', core: true, status: 'met',
            offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' },
            candidateEvidence: [{ sourceId: 'profile', quote: 'React' }], alternatives: [] }] })) });
      });
      await processAiJob(claimed);
      await db.update(jobOffers).set({ company: 'After edit' }).where(eq(jobOffers.id, ids[0]));
      await db.update(aiJobs).set({ nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, job.id));
      const retry = await queue.claimAiJobById(job.id);
      assert.ok(retry);
      await processAiJob(retry);
      assert.equal(prompts.length, 2);
      assert.ok(ids.every(id => prompts[1].includes(id)), 'invalidated success must not be skipped as already saved');
      assert.equal((await queue.getAiJob(job.id))?.status, 'completed');
    });
    await t.test('revoking applications access before the worker starts prevents provider calls', async workerTest => {
      const { AIService } = await import('@/lib/ai-service');
      const { processAiJob } = await import('@/lib/ai-jobs/process');
      await db.update(users).set({ subscriptionStatus: 'none' }).where(eq(users.id, userIds[1]));
      const offerId = randomUUID();
      await db.insert(jobOffers).values({ id: offerId, userId: userIds[1], title: 'Test', company: 'Test', scoreOverall: 42 });
      const job = await queue.enqueueMatchBatchJob(userIds[1], { requestId: randomUUID(), offerIds: [offerId], targetThreshold: 65 });
      const claimed = await queue.claimAiJobById(job.id);
      assert.ok(claimed);
      const ai = workerTest.mock.method(AIService, 'curateOffersBatch', async () => { throw new Error('Provider must not be called'); });
      await processAiJob(claimed);
      assert.equal(ai.mock.callCount(), 0);
      const rejected = await queue.getAiJob(job.id);
      assert.equal(rejected?.status, 'queued');
      assert.match(rejected?.lastError || '', /PRO subscription/);
      const [offer] = await db.select({ score: jobOffers.scoreOverall }).from(jobOffers).where(eq(jobOffers.id, offerId));
      assert.equal(offer.score, 42);
    });
    await t.test('expired leases lose write authority and can be reclaimed', async () => {
      const job = await create(userIds[0]);
      const old = await queue.claimAiJobById(job.id);
      assert.ok(old);
      await db.update(aiJobs).set({ leaseUntil: new Date(0) }).where(and(eq(aiJobs.id, job.id), eq(aiJobs.userId, userIds[0])));
      assert.equal(await queue.saveAiJobProgress(old, {}), false);
      assert.equal(await queue.renewAiJobLease(old), false);
      const current = await queue.claimAiJobById(job.id);
      assert.ok(current);
      assert.equal(current.attempt, 2);
      await queue.completeAiJob(current.id, {}, current);
    });
  } finally {
    await db.delete(users).where(inArray(users.id, userIds));
    await pool.end();
  }
});
