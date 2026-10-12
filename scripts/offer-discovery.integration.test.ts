import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const testUrl = process.env.DISCOVERY_TEST_DATABASE_URL;
test('discovery queue publishes scored offers atomically, deduplicates and protects ownership', { skip: !testUrl }, async t => {
  const url = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  process.env.OPENAI_API_KEY = 'discovery-test-key';
  const { db, pool } = await import('@/db');
  const { aiJobs, users, cvs, jobOffers, companies, usageOperations, planConfigs } = await import('@/db/schema');
  const { defaultPlanConfig } = await import('@/lib/plan-config');
  await db.insert(planConfigs).values({ id: 1, version: 1, config: defaultPlanConfig() }).onConflictDoNothing();
  const { eq, inArray } = await import('drizzle-orm');
  const queue = await import('@/lib/ai-jobs/queue');
  const { enqueueDiscovery, processDiscovery, publishDiscovery, selectDiscoveryMatches, latestDiscovery } = await import('@/lib/offer-discovery/service');
  const { discoveredOfferDescription } = await import('@/lib/offer-discovery/search');
  const { initialDiscoveryProgress, DiscoveryError } = await import('@/lib/offer-discovery/types');
  const { buildCandidateEvidence, buildOfferCard, normalizeMatchItem, MATCH_DIMENSION_KEYS } = await import('@/lib/matching');
  const { parseMatchConstraints } = await import('@/lib/curation-constraints');
  const { applicationSummaryColumns } = await import('@/lib/job-offer-queries');
  const owner = randomUUID(), other = randomUUID(), free = randomUUID(), empty = randomUUID();
  const userIds = [owner, other, free, empty];
  const company = `Discovery ${owner}`;
  const profile = { skills: [{ name: 'React', proficiency: 'core', category: 'frontend' }], experienceYears: 4, targetRoles: ['Frontend Engineer'], curationCriteria: '' };
  const cv = '# Candidate\nReact developer building customer-facing web interfaces in production for a software product.';
  await db.insert(users).values(userIds.map(id => ({ id, email: `discovery-${id}@example.test`, subscriptionStatus: id === free || id === empty ? 'none' : 'active', careerProfile: id === empty ? {} : profile })));
  await db.insert(cvs).values([owner, other, free].map(userId => ({ userId, title: 'Base', content: cv, isBase: true })));
  const constraints = parseMatchConstraints(profile);
  const candidateEvidence = buildCandidateEvidence(profile, cv, constraints);
  const foundOffer = (suffix: string) => ({ id: randomUUID(), title: `Frontend ${suffix}`, company,
    url: `https://jobs.example.com/${owner}/${suffix}`, description: 'Requirements\nReact is required for building customer interfaces. Responsibilities: develop and maintain web applications with the product team.',
    location: null, workplace: null, salary: null, publishedAt: null, closingDate: null, sources: [`https://jobs.example.com/${owner}/${suffix}`],
  });
  const calculate = (offer: ReturnType<typeof foundOffer>, score: number, generation = new Date().toISOString()) => {
    const row = { ...offer, description: discoveredOfferDescription(offer), platform: 'other' };
    const match = normalizeMatchItem({ offer: row, offerCard: buildOfferCard(row, 'triage'), candidateCard: candidateEvidence.card,
      candidateEvidence, constraints, targetThreshold: 65, kind: 'triage', provider: 'openai', model: 'gpt-6-luna',
      llm: { id: row.id, ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, score])), requirements: [
        { id: 'react', name: 'React', kind: 'skill', importance: 'required', core: true, status: 'met', alternatives: [],
          offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' },
          candidateEvidence: [{ sourceId: 'profile', quote: 'React' }] },
      ] },
    });
    match.evaluationStartedAt = generation;
    return match;
  };
  const enqueue = (userId = owner, requestId = randomUUID()) => enqueueDiscovery(userId, { requestId }, userId);
  const claimed = async (userId = owner) => {
    const job = await enqueue(userId);
    const run = await queue.claimAiJobById(job.id);
    assert.ok(run); return run;
  };
  try {
    await t.test('concurrent requests join one search; another actor cannot read it', async () => {
      const requestId = randomUUID();
      const [a, b, c] = await Promise.all([enqueue(owner, requestId), enqueue(owner, requestId), enqueue()]);
      assert.equal(a.id, b.id); assert.equal(a.id, c.id);
      assert.equal(await queue.getAiJobForUser(other, a.id), null);
      const run = await queue.claimAiJobById(a.id); assert.ok(run);
      assert.equal(await queue.completeAiJob(a.id, {}, undefined), undefined);
      const result = await processDiscovery(run, new AbortController().signal, { search: async () => [] });
      assert.equal(result.added.length, 0);
      await queue.completeAiJob(a.id, result, run);
      assert.equal((await latestDiscovery(owner))?.status, 'completed');
    });
    await t.test('missing profile is rejected before quota reservation', async () => {
      await assert.rejects(enqueue(empty), /Añade tu CV/);
      const operations = await db.select({ id: usageOperations.id }).from(usageOperations).where(eq(usageOperations.userId, empty));
      assert.equal(operations.length, 0);
    });
    await t.test('best five validated matches pass; low scores and altered evidence cannot be published', () => {
      const matches = Array.from({ length: 7 }, (_, index) => calculate(foundOffer(`rank-${index}`), 70 + index));
      assert.equal(selectDiscoveryMatches(matches).length, 5);
      assert.equal(selectDiscoveryMatches(matches)[0].score, 76);
      assert.equal(selectDiscoveryMatches([calculate(foundOffer('low'), 20)]).length, 0);
      assert.equal(selectDiscoveryMatches([{ ...matches[0], score: 100 }]).length, 0);
    });
    await t.test('only new fitting offers enter Interested with a visible versioned score', async () => {
      const duplicate = foundOffer('existing');
      await db.insert(jobOffers).values({ userId: owner, title: duplicate.title, company, url: `${duplicate.url}?utm_source=test`, description: duplicate.description, status: 'archived' });
      const suitable = foundOffer('suitable'), low = foundOffer('low');
      const run = await claimed();
      let evaluations = 0;
      const result = await processDiscovery(run, new AbortController().signal, {
        search: async () => [duplicate, suitable, low],
        score: async input => {
          evaluations = input.offers.length;
          return { curated: input.offers.map(item => calculate({ ...(item as unknown as ReturnType<typeof foundOffer>) }, item.title === low.title ? 20 : 90, input.evaluationStartedAt)), errors: [] };
        },
      });
      assert.equal(evaluations, 2); assert.equal(result.duplicates, 1); assert.equal(result.belowThreshold, 1);
      assert.equal(result.added.length, 1);
      const [saved] = await db.select().from(jobOffers).where(eq(jobOffers.id, result.added[0].id));
      assert.equal(saved.status, 'interested'); assert.equal(saved.source, 'openai_web_search');
      assert.equal(saved.description, suitable.description); assert.equal(saved.company, company);
      assert.deepEqual((saved.sourceMetadata as { sources: string[] }).sources, suitable.sources);
      const [summary] = await db.select(applicationSummaryColumns).from(jobOffers).where(eq(jobOffers.id, saved.id));
      assert.equal(summary.scoreOverall, 90); assert.equal('description' in summary, false); assert.equal('matchEvidence' in summary, false);
      const again = await processDiscovery((await queue.getAiJob(run.id))!, new AbortController().signal, { search: async () => { throw new Error('Search must not run after publication'); } });
      assert.deepEqual(again, result);
      // Exercise the real worker dispatcher after a crash between publication and completion.
      const { processAiJob } = await import('@/lib/ai-jobs/process');
      await processAiJob((await queue.getAiJob(run.id))!);
      assert.equal((await queue.getAiJob(run.id))?.status, 'completed');
      const [operation] = await db.select().from(usageOperations).where(eq(usageOperations.id, run.usageOperationId!));
      assert.equal(operation.status, 'consumed'); assert.equal(operation.consumedUnits, 1);
    });
    await t.test('free users can discover jobs within their general AI allowance', async () => {
      const run = await claimed(free);
      const result = await processDiscovery(run, new AbortController().signal, { search: async () => [] });
      assert.equal(result.published, true);
      await queue.completeAiJob(run.id, result, run);
    });
    await t.test('LinkedIn slug/tracking duplicates are skipped even without external IDs', async () => {
      await db.insert(jobOffers).values({ userId: owner, title: 'Existing LinkedIn role', company,
        url: 'https://www.linkedin.com/jobs/view/frontend-engineer-987654321/?trk=public_jobs', status: 'applied' });
      const run = await claimed();
      const result = await processDiscovery(run, new AbortController().signal, {
        search: async () => [{ ...foundOffer('linkedin'), url: 'https://www.linkedin.com/jobs/view/987654321/', sources: ['https://www.linkedin.com/jobs/view/987654321/'] }],
        score: async input => { assert.equal(input.offers.length, 0); return { curated: [], errors: [] }; },
      });
      assert.equal(result.duplicates, 1); assert.equal(result.added.length, 0);
      await queue.completeAiJob(run.id, result, run);
    });
    await t.test('obsolete worker attempts cannot publish, terminate or change progress', async () => {
      const old = await claimed();
      await db.update(aiJobs).set({ leaseUntil: new Date(0) }).where(eq(aiJobs.id, old.id));
      const current = await queue.claimAiJobById(old.id); assert.ok(current);
      const offer = foundOffer('stale');
      await assert.rejects(publishDiscovery(old, candidateEvidence.sourceHash, [offer], [calculate(offer, 90)], initialDiscoveryProgress()), /DISCOVERY_LEASE_LOST/);
      assert.equal(await queue.saveAiJobProgress(old, {}), false);
      assert.equal(await queue.completeAiJob(old.id, {}, old), undefined);
      assert.equal(await queue.failAiJob(old, new Error('late')), undefined);
      await queue.failAiJob(current, new DiscoveryError('DISCOVERY_UNAVAILABLE'));
    });
    await t.test('profile changes reject publication and release the quota on failure', async () => {
      const run = await claimed(); const offer = foundOffer('changed');
      await db.update(users).set({ careerProfile: { ...profile, targetRoles: ['Backend Engineer'] } }).where(eq(users.id, owner));
      await assert.rejects(publishDiscovery(run, candidateEvidence.sourceHash, [offer], [calculate(offer, 90)], initialDiscoveryProgress()), /DISCOVERY_PROFILE_CHANGED/);
      assert.equal((await db.select({ id: jobOffers.id }).from(jobOffers).where(eq(jobOffers.id, offer.id))).length, 0);
      await queue.failAiJob(run, new DiscoveryError('DISCOVERY_PROFILE_CHANGED'));
      const [operation] = await db.select().from(usageOperations).where(eq(usageOperations.id, run.usageOperationId!));
      assert.equal(operation.status, 'released');
      await db.update(users).set({ careerProfile: profile }).where(eq(users.id, owner));
    });
    await t.test('transient failures retry at most three times without spending quota', async () => {
      const job = await enqueue();
      for (let attempt = 1; attempt <= 3; attempt++) {
        const run = await queue.claimAiJobById(job.id); assert.ok(run); assert.equal(run.attempt, attempt);
        await queue.failAiJob(run, new DiscoveryError('DISCOVERY_UNAVAILABLE', true));
        const latest = await queue.getAiJob(job.id); assert.equal(latest?.status, attempt === 3 ? 'failed' : 'queued');
        if (attempt < 3) await db.update(aiJobs).set({ nextAttemptAt: new Date(0) }).where(eq(aiJobs.id, job.id));
      }
      const [operation] = await db.select().from(usageOperations).where(eq(usageOperations.id, job.usageOperationId!));
      assert.equal(operation.status, 'released');
    });
    await t.test('a crash after publication on the final attempt recovers as completed', async () => {
      const run = await claimed(other);
      await processDiscovery(run, new AbortController().signal, { search: async () => [] });
      await db.update(aiJobs).set({ attempt: 3, leaseUntil: new Date(0) }).where(eq(aiJobs.id, run.id));
      await queue.claimNextAiJob();
      const recovered = await queue.getAiJob(run.id);
      assert.equal(recovered?.status, 'completed'); assert.equal(recovered?.lastError, null);
      const [operation] = await db.select().from(usageOperations).where(eq(usageOperations.id, run.usageOperationId!));
      assert.equal(operation.status, 'consumed'); assert.equal(operation.consumedUnits, 1);
    });
  } finally {
    await db.delete(users).where(inArray(users.id, userIds));
    await db.delete(companies).where(eq(companies.name, company));
    await pool.end();
  }
});
