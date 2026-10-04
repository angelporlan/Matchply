import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const testUrl = process.env.USAGE_TEST_DATABASE_URL;
test('AI usage is reserved at admission and settled with durable results', { skip: !testUrl }, async t => {
  const parsed = new URL(testUrl!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) && parsed.pathname.includes('test'), 'Use an isolated local test database');
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users, cvs, jobOffers, aiJobs, usageOperations, usagePeriods, jobResearchRuns } = await import('@/db/schema');
  const { eq, and, inArray, sql } = await import('drizzle-orm');
  const usage = await import('@/lib/usage');
  const queue = await import('@/lib/ai-jobs/queue');
  const research = await import('@/lib/research/queue');
  const researchWorker = await import('@/lib/research/worker-queue');
  const fixtures: string[] = [];
  const makeUser = async (pro = false) => {
    const id = randomUUID(); fixtures.push(id);
    await db.insert(users).values({ id, email: `usage-${id}@example.test`, subscriptionStatus: pro ? 'active' : 'none', careerProfile: { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 } });
    return id;
  };
  const offer = async (userId: string) => {
    const [row] = await db.insert(jobOffers).values({ userId, title: 'Frontend', company: 'Usage fixture', description: 'Requirements\nReact is required for building customer interfaces.', scoreOverall: 83 }).returning();
    return row;
  };
  const reserve = (userId: string, units: number, bucket: 'general' | 'matching' = 'general') => usage.beginUsage(userId, { bucket, requestId: randomUUID(), action: 'fixture', input: { units, bucket }, units });
  try {
    await t.test('the final shared action accepts one concurrent request; failures release it', async () => {
      const userId = await makeUser();
      const first = await reserve(userId, 9);
      await db.transaction(tx => usage.consumeUsage(tx, first.id, { fixture: true }));
      const attempts = await Promise.allSettled([reserve(userId, 1), reserve(userId, 1)]);
      assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
      const rejected = attempts.find(item => item.status === 'rejected') as PromiseRejectedResult;
      assert.equal(rejected.reason.code, 'QUOTA_EXCEEDED');
      const held = (attempts.find(item => item.status === 'fulfilled') as PromiseFulfilledResult<typeof first>).value;
      assert.equal((await usage.getUsageSnapshot(userId)).usage.general.reserved, 1);
      await db.transaction(tx => usage.releaseUsage(tx, held.id));
      const replacement = await queue.enqueueImportOfferJob(userId, { url: 'https://example.test/jobs/one', requestId: randomUUID() }, userId);
      assert.ok(replacement.usageOperationId);
      const claimed = await queue.claimAiJobById(replacement.id); assert.ok(claimed);
      await queue.failAiJob(claimed, new Error('Invalid offer'));
      assert.deepEqual((await usage.getUsageSnapshot(userId)).usage.general, { used: 9, reserved: 0, limit: 10, remaining: 1, resetAt: usage.nextUsageMonth(usage.utcUsageMonth()).toISOString() });
    });
    await t.test('lost enqueue responses replay one job and one reservation; conflicting bodies fail', async () => {
      const userId = await makeUser(); const requestId = randomUUID();
      const payload = { url: 'https://example.test/jobs/one', requestId };
      const [one, two] = await Promise.all([queue.enqueueImportOfferJob(userId, payload, userId), queue.enqueueImportOfferJob(userId, payload, userId)]);
      assert.equal(one.id, two.id);
      await assert.rejects(queue.enqueueImportOfferJob(userId, { ...payload, url: 'https://example.test/jobs/two' }, userId), /OFFER_REQUEST_CONFLICT/);
      const claimed = await queue.claimAiJobById(one.id); assert.ok(claimed);
      await queue.completeAiJob(one.id, { jobTitle: 'Frontend', company: 'Fixture', jobDescription: 'React' }, claimed);
      await queue.completeAiJob(one.id, { duplicate: true }, claimed);
      assert.equal((await usage.getUsageSnapshot(userId)).usage.general.used, 1);
      assert.equal((await usage.getUsageSnapshot(userId)).usage.general.reserved, 0);
      const rows = await db.select().from(usageOperations).where(eq(usageOperations.userId, userId)); assert.equal(rows.length, 1);
    });
    await t.test('settlement waits for quota ownership before locking its job', async () => {
      const userId = await makeUser();
      const job = await queue.enqueueImportOfferJob(userId, { url: 'https://example.test/jobs/locks', requestId: randomUUID() }, userId);
      const claimed = await queue.claimAiJobById(job.id); assert.ok(claimed);
      const blocker = await pool.connect();
      let completing: Promise<unknown> | undefined;
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`usage:${userId}`]);
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        completing = queue.completeAiJob(job.id, { jobTitle: 'Durable lock result' }, claimed);
        let waiting = false;
        for (let i = 0; i < 100 && !waiting; i++) {
          waiting = (await pool.query('SELECT 1 FROM pg_stat_activity WHERE $1::int = ANY(pg_blocking_pids(pid))', [pid])).rowCount! > 0;
          if (!waiting) await delay(5);
        }
        assert.ok(waiting, 'completion reached the quota lock');
        await blocker.query('SELECT id FROM ai_job WHERE id=$1 FOR UPDATE NOWAIT', [job.id]);
        await blocker.query('COMMIT');
        await completing;
        assert.equal((await usage.getUsageSnapshot(userId)).usage.general.used, 1);
      } finally {
        await blocker.query('ROLLBACK'); blocker.release();
        if (completing) await completing;
      }
    });
    await t.test('Free individual matching is admitted; Free batches and oversized Pro batches never reserve', async () => {
      const free = await makeUser(), pro = await makeUser(true);
      const a = await offer(free), b = await offer(free);
      const job = await queue.enqueueMatchBatchJob(free, { offerIds: [a.id], targetThreshold: 65, requestId: randomUUID(), kind: 'deep' });
      assert.ok(job.usageOperationId);
      await assert.rejects(queue.enqueueMatchBatchJob(free, { offerIds: [a.id, b.id], targetThreshold: 65, requestId: randomUUID() }), error => (error as { code?: string }).code === 'PRO_REQUIRED');
      await assert.rejects(queue.enqueueMatchBatchJob(pro, { offerIds: Array.from({ length: 51 }, () => randomUUID()), targetThreshold: 65, requestId: randomUUID() }), error => (error as { code?: string }).code === 'MATCH_BATCH_TOO_LARGE');
      assert.equal((await usage.getUsageSnapshot(free)).usage.matching.reserved, 1);
      assert.equal((await usage.getUsageSnapshot(pro)).usage.matching.reserved, 0);
    });
    await t.test('batch successes consume once; retries hold only unfinished offers and terminal failure releases them', async sub => {
      const userId = await makeUser(true); const offers = [await offer(userId), await offer(userId)];
      const { AIService } = await import('@/lib/ai-service');
      const { MATCH_DIMENSION_KEYS } = await import('@/lib/matching');
      const { processAiJob } = await import('@/lib/ai-jobs/process');
      const provider = sub.mock.method(AIService as any, 'callMatchText', async () => JSON.stringify({ curated: [{ id: offers[0].id,
        ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, 0])), requirements: [{ id: 'r1', name: 'React', kind: 'skill', importance: 'required', core: true, status: 'met', offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' }, candidateEvidence: [{ sourceId: 'profile', quote: 'React' }], alternatives: [] }],
      }] }));
      const job = await queue.enqueueMatchBatchJob(userId, { offerIds: offers.map(row => row.id), targetThreshold: 65, requestId: randomUUID() });
      const claimed = await queue.claimAiJobById(job.id); assert.ok(claimed);
      await processAiJob(claimed);
      let snapshot = await usage.getUsageSnapshot(userId); assert.equal(snapshot.usage.matching.used, 1); assert.equal(snapshot.usage.matching.reserved, 1);
      await db.update(aiJobs).set({ attempt: 2, nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, job.id));
      const retry = await queue.claimAiJobById(job.id); assert.ok(retry);
      await processAiJob(retry);
      assert.equal((await queue.getAiJob(job.id))?.status, 'failed');
      snapshot = await usage.getUsageSnapshot(userId); assert.equal(snapshot.usage.matching.used, 1); assert.equal(snapshot.usage.matching.reserved, 0);
      assert.ok(provider.mock.callCount() >= 2);
      const [period] = await db.select().from(usagePeriods).where(and(eq(usagePeriods.userId, userId), eq(usagePeriods.bucket, 'matching'))); assert.ok(period.reserved >= 0);
    });
    await t.test('legacy batches finish under their original policy without filling the new allowance', async sub => {
      const userId = await makeUser(true); const offers = [await offer(userId), await offer(userId)];
      const { AIService } = await import('@/lib/ai-service');
      const { MATCH_DIMENSION_KEYS } = await import('@/lib/matching');
      const { processAiJob } = await import('@/lib/ai-jobs/process');
      sub.mock.method(AIService as any, 'callMatchText', async () => JSON.stringify({ curated: offers.map(target => ({ id: target.id,
        ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, 0])), requirements: [{ id: 'r1', name: 'React', kind: 'skill', importance: 'required', core: true, status: 'met', offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' }, candidateEvidence: [{ sourceId: 'profile', quote: 'React' }], alternatives: [] }],
      })) }));
      const job = await queue.enqueueMatchBatchJob(userId, { offerIds: offers.map(row => row.id), targetThreshold: 65, requestId: randomUUID() });
      await db.transaction(async tx => {
        const [operation] = await tx.select().from(usageOperations).where(eq(usageOperations.id, job.usageOperationId!));
        await tx.update(usagePeriods).set({ reserved: sql`${usagePeriods.reserved} - ${operation.units}` }).where(eq(usagePeriods.id, operation.periodId));
        await tx.update(usageOperations).set({ status: 'consumed', consumedUnits: operation.units, configVersion: 0, plan: 'legacy' }).where(eq(usageOperations.id, operation.id));
      });
      const claimed = await queue.claimAiJobById(job.id); assert.ok(claimed); await processAiJob(claimed);
      assert.equal((await queue.getAiJob(job.id))?.status, 'completed');
      assert.equal((await usage.getUsageSnapshot(userId)).usage.matching.used, 0);
      assert.equal((await usage.getUsageSnapshot(userId)).usage.matching.reserved, 0);
    });
    await t.test('an admitted CV can publish after downgrade; another operation cannot overwrite its destination', async () => {
      const userId = await makeUser(true);
      const access = await import('@/lib/cv-access');
      const { assertCvPublication } = await import('@/lib/ai-cv-publication');
      const base = await access.createCvForUser(userId, { title: 'Base', content: 'Original base', isBase: true });
      const selected = [await access.createCvForUser(userId, { title: 'Selected one', content: 'One', isBase: false }), await access.createCvForUser(userId, { title: 'Selected two', content: 'Two', isBase: false })];
      const target = await access.createCvForUser(userId, { title: 'In-flight version', content: 'Keep this if generation fails', isBase: false });
      await access.selectActiveCvs(userId, base.id, selected.map(cv => cv.id));
      const operation = await usage.beginUsage(userId, { bucket: 'general', action: 'optimize_cv', requestId: randomUUID(), input: { targetCvId: target.id } });
      await db.transaction(tx => access.reserveCvTarget(tx, userId, { baseCvId: base.id, targetCvId: target.id, confirmOverwrite: true, operationId: operation.id, values: { isBase: false } }));
      await db.update(users).set({ subscriptionStatus: 'none' }).where(eq(users.id, userId));
      await assert.rejects(db.transaction(tx => access.requireEditableCv(tx, userId, target.id)), error => (error as { code?: string }).code === 'CV_READ_ONLY');
      await db.transaction(async tx => {
        await assertCvPublication(tx, userId, target.id, operation.id);
        await tx.update(cvs).set({ content: 'Complete adapted result', pendingUsageOperationId: null }).where(eq(cvs.id, target.id));
        await usage.consumeUsage(tx, operation.id, { cvId: target.id });
      });
      const [saved] = await db.select().from(cvs).where(eq(cvs.id, target.id)); assert.equal(saved.content, 'Complete adapted result');
      assert.equal((await usage.getUsageSnapshot(userId)).usage.general.used, 1);
      await assert.rejects(db.transaction(tx => assertCvPublication(tx, userId, target.id, operation.id)), error => (error as { code?: string }).code === 'OPERATION_RELEASED');
      const second = await usage.beginUsage(userId, { bucket: 'general', action: 'optimize_cv', requestId: randomUUID(), input: { targetCvId: selected[0].id } });
      await db.transaction(tx => access.reserveCvTarget(tx, userId, { targetCvId: selected[0].id, confirmOverwrite: true, operationId: second.id, values: { isBase: false } }));
      await db.update(cvs).set({ pendingUsageOperationId: null }).where(eq(cvs.id, selected[0].id));
      await assert.rejects(db.transaction(tx => assertCvPublication(tx, userId, selected[0].id, second.id)), error => (error as { code?: string }).code === 'CV_OPERATION_LOST');
      await db.transaction(tx => usage.releaseUsage(tx, second.id));
    });
    await t.test('registering a guest preserves an admitted CV publication and transfers its charge', async () => {
      const guestId = await makeUser(), accountId = await makeUser();
      await db.update(users).set({ isGuest: true }).where(eq(users.id, guestId));
      const access = await import('@/lib/cv-access');
      const { assertCvPublication } = await import('@/lib/ai-cv-publication');
      const { findOrCreateCompany } = await import('@/lib/company-service');
      const base = await access.createCvForUser(guestId, { title: 'Guest base', content: 'Original', isBase: true });
      const operation = await usage.beginUsage(guestId, { bucket: 'general', action: 'optimize_cv', requestId: randomUUID(), input: { baseCvId: base.id } });
      const targetId = await db.transaction(tx => access.reserveCvTarget(tx, guestId, { baseCvId: base.id, operationId: operation.id, values: { isBase: false } }));
      await db.transaction(async tx => {
        await usage.transferGuestUsage(tx, guestId, accountId);
        await tx.update(cvs).set({ userId: accountId }).where(eq(cvs.userId, guestId));
        await tx.delete(users).where(eq(users.id, guestId));
      });
      await db.transaction(async tx => {
        const ownerId = await assertCvPublication(tx, guestId, targetId, operation.id);
        assert.equal(ownerId, accountId);
        const company = await findOrCreateCompany(ownerId, 'Guest publication fixture', tx); assert.ok(company);
        await tx.update(cvs).set({ content: 'Complete guest result', pendingUsageOperationId: null }).where(and(eq(cvs.id, targetId), eq(cvs.userId, ownerId)));
        await tx.insert(jobOffers).values({ userId: ownerId, cvId: targetId, title: 'Frontend', company: company.name, companyId: company.id });
        await usage.consumeUsage(tx, operation.id, { cvId: targetId });
      });
      assert.equal((await usage.getUsageSnapshot(accountId)).usage.general.used, 1);
      assert.equal((await usage.getUsageSnapshot(accountId)).usage.general.reserved, 0);
      const [saved] = await db.select().from(cvs).where(eq(cvs.id, targetId)); assert.equal(saved.userId, accountId); assert.equal(saved.content, 'Complete guest result');
    });
    await t.test('research captures deduplicate and exhausted leases return reservations', async () => {
      const userId = await makeUser(true); const target = await offer(userId);
      const [one, two] = await Promise.all([research.enqueueResearchForOffer(userId, target.id), research.enqueueResearchForOffer(userId, target.id)]);
      assert.equal(one.run?.id, two.run?.id); assert.ok(one.run?.usageOperationId);
      assert.equal((await research.getResearchQuota(userId)).reserved, 1);
      const claimed = await researchWorker.claimNextResearchRun(); assert.equal(claimed?.id, one.run!.id); assert.ok(claimed);
      await db.update(jobResearchRuns).set({ attempt: 3, leaseUntil: new Date(0) }).where(eq(jobResearchRuns.id, claimed.id));
      await researchWorker.claimNextResearchRun();
      assert.equal((await research.getResearchQuota(userId)).used, 0); assert.equal((await research.getResearchQuota(userId)).reserved, 0);
      await research.enqueueResearchForOffer(userId, target.id, { retryFailed: true });
      assert.equal((await research.getResearchQuota(userId)).reserved, 1);
      const retried = await researchWorker.claimNextResearchRun(); assert.ok(retried);
      await db.update(jobResearchRuns).set({ attempt: 3 }).where(eq(jobResearchRuns.id, retried.id));
      await researchWorker.failResearchRun({ ...retried, attempt: 3 }, new Error('Fixture terminal failure'));
    });
    await t.test('a useful research report consumes atomically; aborted work does not publish or consume', async sub => {
      const userId = await makeUser(true); const target = await offer(userId);
      const { runResearch } = await import('@/lib/research/orchestrator');
      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = 'quota-fixture-key';
      const fakeFetch = sub.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ status: 'completed', summary: 'Evidence remains limited.', findings: [], strengths: [], redFlags: [], unknowns: ['Unverified information.'], nextSteps: [], score: 70, confidence: 0.5 }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
      try {
        const admitted = await research.enqueueResearchForOffer(userId, target.id); assert.ok(admitted.run);
        const claimed = await researchWorker.claimNextResearchRun(); assert.equal(claimed?.id, admitted.run.id); assert.ok(claimed);
        const result = await runResearch(claimed.id, { attempt: claimed.attempt, signal: new AbortController().signal });
        assert.equal(result.status, 'completed');
        assert.equal((await research.getResearchQuota(userId)).used, 1); assert.equal((await research.getResearchQuota(userId)).reserved, 0);
        const [saved] = await db.select().from(jobResearchRuns).where(eq(jobResearchRuns.id, claimed.id)); assert.ok(saved.report);
        assert.equal(fakeFetch.mock.callCount(), 5, 'four specialists and synthesizer form one research unit');
        const secondOffer = await offer(userId); const second = await research.enqueueResearchForOffer(userId, secondOffer.id); assert.ok(second.run);
        const secondClaim = await researchWorker.claimNextResearchRun(); assert.equal(secondClaim?.id, second.run.id); assert.ok(secondClaim);
        const controller = new AbortController(); controller.abort(new Error('Fixture cancelled'));
        await assert.rejects(runResearch(secondClaim.id, { attempt: secondClaim.attempt, signal: controller.signal }), /Fixture cancelled/);
        assert.equal(fakeFetch.mock.callCount(), 5);
        await db.update(jobResearchRuns).set({ attempt: 3 }).where(eq(jobResearchRuns.id, secondClaim.id));
        await researchWorker.failResearchRun({ ...secondClaim, attempt: 3 }, new Error('Fixture cancelled'));
        assert.equal((await research.getResearchQuota(userId)).used, 1); assert.equal((await research.getResearchQuota(userId)).reserved, 0);
      } finally { if (previousKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previousKey; }
    });
    await t.test('expired last AI attempt cannot strand quota and stale workers cannot consume', async () => {
      const userId = await makeUser();
      const job = await queue.enqueueImportOfferJob(userId, { url: 'https://example.test/jobs/expired', requestId: randomUUID() }, userId);
      const claimed = await queue.claimAiJobById(job.id); assert.ok(claimed);
      await db.update(aiJobs).set({ attempt: 3, leaseUntil: new Date(0) }).where(eq(aiJobs.id, job.id));
      await queue.claimNextAiJob();
      assert.equal((await queue.getAiJob(job.id))?.status, 'failed');
      assert.equal(await queue.completeAiJob(job.id, { title: 'stale' }, claimed), undefined);
      assert.equal((await usage.getUsageSnapshot(userId)).usage.general.reserved, 0);
      assert.equal((await usage.getUsageSnapshot(userId)).usage.general.used, 0);
    });
  } finally { await db.delete(users).where(inArray(users.id, fixtures)); await pool.end(); }
});
