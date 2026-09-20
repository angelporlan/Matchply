import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { buildCandidateEvidence, buildOfferCard, normalizeMatchItem, normalizeMatchDetails, MATCH_DIMENSION_KEYS } from '@/lib/matching';
import { parseMatchConstraints } from '@/lib/curation-constraints';

const url = process.env.MATCH_BATCH_TEST_DATABASE_URL;
test('Postgres matching persistence, invalidation triggers and lightweight reads', { skip: !url }, async t => {
  const parsed = new URL(url!);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && parsed.pathname.includes('test'), 'Use an isolated local test database');
  process.env.DATABASE_URL = url;
  const { db, pool } = await import('@/db');
  const { users, cvs, jobOffers } = await import('@/db/schema');
  const { persistMatchResult } = await import('@/lib/match-persistence');
  const { applicationSummaryColumns } = await import('@/lib/job-offer-queries');
  const owner = randomUUID();
  let profile: any = { experienceYears: 3, skills: [{ name: 'React', proficiency: 'core', category: 'frontend' }] };
  let cv = '# Candidate\nReact developer building customer-facing web interfaces in production for a software product.';
  await db.insert(users).values({ id: owner, email: `matching-${owner}@example.test`, careerProfile: profile });
  const [base] = await db.insert(cvs).values({ userId: owner, title: 'Base', content: cv, isBase: true }).returning();
  let [offer] = await db.insert(jobOffers).values({ userId: owner, title: 'Frontend', company: 'Acme', description: 'Requirements\nReact is required for building customer interfaces.' }).returning();
  let generation = 1;
  const calculate = (score = 90) => {
    const constraints = parseMatchConstraints(profile);
    const candidateEvidence = buildCandidateEvidence(profile, cv, constraints);
    const result = normalizeMatchItem({ offer, offerCard: buildOfferCard(offer, 'triage'), candidateCard: candidateEvidence.card,
      candidateEvidence, constraints, targetThreshold: 65, kind: 'triage', model: 'test', provider: 'test',
      llm: { id: offer.id, ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, score])), requirements: [
        { id: 'r1', name: 'React', kind: 'skill', importance: 'required', core: true, status: 'met', alternatives: [],
          offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' },
          candidateEvidence: [{ sourceId: 'profile', quote: 'React' }] },
        ...(offer.description?.includes('portfolio.') ? [{ id: 'r2', name: 'Portfolio', kind: 'other',
          importance: 'required', core: false, status: 'unknown', alternatives: [], candidateEvidence: [],
          offerEvidence: { sourceId: 'offer', quote: 'Additional mandatory qualifications: portfolio.' } }] : []),
      ] },
    });
    result.evaluationStartedAt = new Date(Date.UTC(2026, 8, 15, 10, generation++)).toISOString();
    return result;
  };
  try {
    await t.test('zero persists, old generations and another owner are rejected', async () => {
      const old = calculate();
      const zero = calculate(0);
      assert.equal(await persistMatchResult(owner, zero), true);
      assert.equal(await persistMatchResult(owner, old), false);
      assert.equal(await persistMatchResult(randomUUID(), calculate()), false);
      const [saved] = await db.select(applicationSummaryColumns).from(jobOffers).where(eq(jobOffers.id, offer.id));
      assert.equal(saved.scoreOverall, 0);
      assert.equal('matchEvidence' in saved, false);
      assert.equal('description' in saved, false);
    });
    await t.test('triage does not delete compatible detail', async () => {
      const deep = calculate();
      deep.details = normalizeMatchDetails({ summary: 'Competencia acreditada.',
        dimensions: MATCH_DIMENSION_KEYS.map(key => ({ key, explanation: 'Según evidencia.', requirementIds: ['r1'] })),
        requirements: [{ requirementId: 'r1', explanation: 'React está acreditado.' }], nextSteps: [] }, deep.evidence);
      deep.kind = 'deep';
      assert.equal(await persistMatchResult(owner, deep), true);
      assert.equal(await persistMatchResult(owner, calculate()), true);
      const [saved] = await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id));
      assert.deepEqual(saved.matchDetails, deep.details);
      assert.equal(saved.matchKind, 'deep');
    });
    await t.test('JD edit hides stale score and rejects in-flight old inputs', async () => {
      const pending = calculate();
      [offer] = await db.update(jobOffers).set({ description: `${offer.description}\nAdditional mandatory qualifications: portfolio.` }).where(eq(jobOffers.id, offer.id)).returning();
      assert.equal(offer.matchInputHash, null);
      assert.equal(await persistMatchResult(owner, pending), false);
      const [summary] = await db.select(applicationSummaryColumns).from(jobOffers).where(eq(jobOffers.id, offer.id));
      assert.equal(summary.scoreOverall, null);
      assert.equal(offer.scoreOverall, 90, 'preserve last real score internally');
      assert.equal(await persistMatchResult(owner, calculate()), true);
    });
    await t.test('profile edit invalidates, cosmetic CV edit and non-base insert do not', async () => {
      profile = { ...profile, targetRoles: ['Frontend engineer'] };
      await db.update(users).set({ careerProfile: profile }).where(eq(users.id, owner));
      let [saved] = await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id));
      assert.equal(saved.matchInputHash, null);
      const current = calculate();
      assert.equal(await persistMatchResult(owner, current), true);
      await db.update(cvs).set({ accentColor: '#123456' }).where(eq(cvs.id, base.id));
      await db.insert(cvs).values({ userId: owner, title: 'Adapted', content: 'Different content', isBase: false });
      await db.update(users).set({ careerProfile: { ...profile, updatedAt: new Date().toISOString() } }).where(eq(users.id, owner));
      [saved] = await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id));
      assert.equal(saved.matchInputHash, current.inputHash);
    });
    await t.test('selected CV content edit invalidates and rejects stale evidence', async () => {
      const pending = calculate();
      cv += '\nNew experience in customer support.';
      await db.update(cvs).set({ content: cv }).where(eq(cvs.id, base.id));
      const [saved] = await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id));
      assert.equal(saved.matchInputHash, null);
      assert.equal(await persistMatchResult(owner, pending), false);
      assert.equal(await persistMatchResult(owner, calculate()), true);
    });
  } finally {
    await db.delete(users).where(eq(users.id, owner));
    await pool.end();
  }
});
