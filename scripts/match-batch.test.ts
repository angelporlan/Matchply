import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  addMatchBatchError, addMatchBatchScore, matchBatchCounts, pendingMatchOfferIds, readMatchBatchResult, unfinishedMatchOfferIds,
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

test('a confirmed description miss finishes that offer without hiding a scoring failure', () => {
  const progress = readMatchBatchResult({ total: 3, items: [{ id: 'scored', score: 70 }], errors: [
    { id: 'missing', message: 'No se encontró la descripción pública de esta oferta.', code: 'lookup' },
    { id: 'retry', message: 'No se pudo recuperar la descripción de la oferta. Vuelve a intentarlo.' },
  ] });
  assert.equal(progress.errors.find(error => error.id === 'missing')?.code, 'lookup');
  assert.equal(progress.errors.find(error => error.id === 'retry')?.code, undefined);
  assert.deepEqual(unfinishedMatchOfferIds(['scored', 'missing', 'retry'], progress), ['retry']);
  assert.deepEqual(pendingMatchOfferIds(['scored', 'missing', 'retry'], progress), ['missing', 'retry']);
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
  await db.insert(users).values(userIds.map(id => ({ id, email: `batch-${id}@example.test`, subscriptionStatus: 'active' })));
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
      workerTest.mock.method(AIService as any, 'routeModel', async () => ({ provider: 'gemini', model: 'queue-test' }));
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
      workerTest.mock.method(AIService as any, 'routeModel', async () => ({ provider: 'gemini', model: 'queue-test' }));
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
    await t.test('Free batch admission rejects before creating a job or calling a provider', async workerTest => {
      const { AIService } = await import('@/lib/ai-service');
      await db.update(users).set({ subscriptionStatus: 'none' }).where(eq(users.id, userIds[1]));
      const offerIds = [randomUUID(), randomUUID()];
      await db.insert(jobOffers).values(offerIds.map(id => ({ id, userId: userIds[1], title: 'Test', company: 'Test', scoreOverall: 42 })));
      const ai = workerTest.mock.method(AIService, 'curateOffersBatch', async () => { throw new Error('Provider must not be called'); });
      await assert.rejects(queue.enqueueMatchBatchJob(userIds[1], { requestId: randomUUID(), offerIds, targetThreshold: 65 }), /requiere.*Pro/i);
      assert.equal(ai.mock.callCount(), 0);
      const rows = await db.select({ score: jobOffers.scoreOverall }).from(jobOffers).where(inArray(jobOffers.id, offerIds));
      assert.ok(rows.every(row => row.score === 42));
      await db.update(users).set({ subscriptionStatus: 'active' }).where(eq(users.id, userIds[1]));
    });
    await t.test('50 selected offers cross pagination, recover missing descriptions and publish each score immediately', async workerTest => {
      const { AIService } = await import('@/lib/ai-service');
      const { processMatchBatch } = await import('@/lib/ai-jobs/match-batch');
      const { listApplicationsPage, listApplicationIds, listSelectedApplications } = await import('@/lib/application-list-query');
      const ids: string[] = Array.from({ length: 50 }, () => randomUUID());
      const owner = randomUUID(); userIds.push(owner);
      await db.insert(users).values({ id: owner, email: `selection-${owner}@example.test`, subscriptionStatus: 'active',
        careerProfile: { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 } });
      const description = 'Requirements\nReact is required for building customer interfaces.\nYou must be eligible to work in Spain.';
      const sourceUrls = ids.map((_id, index) => `https://www.linkedin.com/jobs/view/${8000000000 + index}/`);
      await db.insert(jobOffers).values(ids.map((id, index) => ({ id, userId: owner, title: `Captured role ${index}`, company: 'Captured company',
        url: sourceUrls[index], description: index < 25 ? description : index % 2 ? '' : `Captured role ${index}\nCaptured company\nMadrid`,
        sourceMetadata: index < 25 ? { captureKind: 'detail' } : { captureKind: 'list', location: 'Madrid' },
        rawReport: 'PRIVATE_REPORT_SENTINEL', coverLetter: 'PRIVATE_LETTER_SENTINEL' })));
      const query = { userId: owner, filters: {}, sort: { key: 'createdAt' as const, direction: 'desc' as const }, pageSize: 25 };
      assert.equal((await listApplicationsPage(query)).items.length, 25);
      const selectedIds = await listApplicationIds(query);
      assert.equal(selectedIds.length, 50);
      const selected = await listSelectedApplications(owner, selectedIds);
      assert.deepEqual(selected.map(row => row.id), selectedIds);
      assert.equal(selected.length, 50);
      assert.ok(selected.every(row => !('description' in row) && !('rawReport' in row) && !('coverLetter' in row)));
      assert.ok(!JSON.stringify(selected).includes('PRIVATE_'));
      await assert.rejects(listSelectedApplications(userIds[1], selectedIds), /no están disponibles/);
      await assert.rejects(listSelectedApplications(owner, [...selectedIds, randomUUID()]), /no están disponibles/);

      const job = await queue.enqueueMatchBatchJob(owner, { requestId: randomUUID(), offerIds: selectedIds, targetThreshold: 65 });
      const claimed = await queue.claimAiJobById(job.id); assert.ok(claimed);
      workerTest.mock.method(AIService as any, 'routeModel', async () => ({ provider: 'openai', model: 'gpt-6-luna' }));
      workerTest.mock.method(AIService as any, 'callOpenAIDecisions', async (input: string, questions: Array<{ type: string; name: string }>) => {
        const id = input.match(/Oferta ([0-9a-f-]{36})/)?.[1]; assert.ok(id);
        const [row] = await db.select({ description: jobOffers.description }).from(jobOffers).where(eq(jobOffers.id, id));
        assert.equal(row.description, description, 'the recovered description must be saved before scoring');
        return questions.map(question => question.type === 'score'
          ? { type: 'score', name: question.name, score: id === ids[0] ? 0 : 4 }
          : { type: 'choice', name: question.name, choice: 'met' });
      });
      let lastRecoveredId: string | null = null;
      let currentUrl = '';
      let downloads = 0;
      let searches = 0;
      const output = (text: string) => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] });
      const progress = await processMatchBatch(claimed, undefined, {
        apiKey: 'test-only',
        download: async url => {
          if (lastRecoveredId) {
            const currentJob = await queue.getAiJob(job.id);
            assert.ok(readMatchBatchResult(currentJob?.result).items.some(item => item.id === lastRecoveredId), 'publish each recovered score before downloading the next offer');
          }
          currentUrl = url;
          const index = sourceUrls.indexOf(url); assert.ok(index >= 25);
          downloads += 1; lastRecoveredId = ids[index];
          if (downloads === 1) throw new Error('Public page unavailable');
          return { url, visitedUrls: [url], html: `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', url, title: 'Recovered role', hiringOrganization: { name: 'Recovered company' }, description })}</script>` };
        },
        respond: async body => {
          if (body.tools) { searches += 1; return { ...output(description), output: [{ type: 'web_search_call', action: { type: 'open_page', url: currentUrl } }, ...output(description).output] }; }
          return output(JSON.stringify({ isJobOffer: true, jobTitle: 'Recovered role', company: 'Recovered company', jobDescription: description }));
        },
      });
      assert.equal(downloads, 25); assert.equal(searches, 1);
      assert.equal(progress.total, 50); assert.equal(progress.items.length, 50); assert.equal(progress.errors.length, 0);
      assert.equal(progress.items.find(item => item.id === ids[0])?.score, 0);
      const saved = await db.select({ id: jobOffers.id, description: jobOffers.description, title: jobOffers.title, company: jobOffers.company,
        score: jobOffers.scoreOverall, sourceMetadata: jobOffers.sourceMetadata }).from(jobOffers).where(eq(jobOffers.userId, owner));
      for (const row of saved) {
        assert.equal(row.description, description);
        assert.equal(row.title, `Captured role ${ids.indexOf(row.id)}`);
        assert.equal(row.company, 'Captured company');
        assert.equal((row.sourceMetadata as any).captureKind, 'detail');
        assert.equal(row.score, row.id === ids[0] ? 0 : 100);
      }
      assert.ok(await queue.completeAiJob(job.id, progress, claimed));
      assert.equal((await queue.getAiJob(job.id))?.status, 'completed');
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
