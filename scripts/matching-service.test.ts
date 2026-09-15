import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '@/lib/ai-service';
import { MATCH_DIMENSION_KEYS } from '@/lib/matching/types';
import { mayPersistMatch } from '@/lib/match-persistence';

const profile = { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 };
const offer = { id: 'offer1', title: 'Frontend', company: 'Acme', platform: 'other', description: 'Requirements\nReact is required for building customer interfaces.' };
const llm = (id = 'offer1', score = 90) => ({ id,
  ...Object.fromEntries(MATCH_DIMENSION_KEYS.map(key => [key, score])),
  requirements: [{ id: 'r1', name: 'React', kind: 'skill', importance: 'required', core: true,
    status: 'met', offerEvidence: { sourceId: 'offer', quote: 'React is required for building customer interfaces.' },
    candidateEvidence: [{ sourceId: 'profile', quote: 'React' }], alternatives: [] }],
});
const input = { baseCvMarkdown: '', userCareerProfile: profile, offers: [offer], userSubscriptionStatus: 'active' };

test('triage and deep share the same score; explanation is generated once and not recalculated', async t => {
  t.mock.method(AIService as any, 'getSetting', async (key: string) => key.endsWith('provider') ? 'gemini' : 'model-test');
  const prompts: string[] = [];
  t.mock.method(AIService as any, 'callMatchText', async (_provider: string, _model: string, system: string, user: string) => {
    prompts.push(system);
    if (system.startsWith('Explica')) {
      const snapshot = JSON.parse(user);
      return JSON.stringify({ summary: 'Competencia acreditada.',
        dimensions: MATCH_DIMENSION_KEYS.map(key => ({ key, explanation: 'Según la evidencia evaluada.', requirementIds: ['r1'] })),
        requirements: snapshot.requirements.map((req: any) => ({ requirementId: req.id, explanation: 'React figura en el perfil.' })),
        nextSteps: ['Revisar las condiciones con la empresa.'] });
    }
    return JSON.stringify({ curated: [llm()] });
  });
  const first = (await AIService.curateOffersBatch(input)).curated[0];
  assert.equal(first.score, 90);
  assert.equal(first.fitReason, '');
  assert.equal(first.details, undefined);
  assert.equal(prompts.length, 1);
  const cached = { ...offer, scoreOverall: first.score, scoreBreakdown: first.scoreBreakdown,
    matchInputHash: first.inputHash, matchEvidence: first.evidence };
  const deep = (await AIService.curateOffersBatch({ ...input, offers: [cached], kind: 'deep' })).curated[0];
  assert.equal(prompts.length, 2);
  assert.equal(deep.score, first.score);
  assert.equal(deep.inputHash, first.inputHash);
  assert.equal(deep.details?.inputHash, first.inputHash);
  const reused = await AIService.curateOffersBatch({ ...input, offers: [{ ...cached, matchDetails: deep.details }], kind: 'deep' });
  assert.equal(prompts.length, 2);
  assert.deepEqual(reused.curated[0].details, deep.details);
});

test('invalid dimensions or missing IDs never fabricate a 50; a valid zero is retained', async t => {
  t.mock.method(AIService as any, 'getSetting', async () => 'test');
  const responses = [{ curated: [{ id: offer.id }] }, { curated: [] }, { curated: [llm(offer.id, 0)] }];
  t.mock.method(AIService as any, 'callMatchText', async () => JSON.stringify(responses.shift()));
  for (let i = 0; i < 2; i++) {
    const result = await AIService.curateOffersBatch(input);
    assert.equal(result.curated.length, 0);
    assert.equal(result.errors.length, 1);
  }
  const zero = await AIService.curateOffersBatch(input);
  assert.equal(zero.curated[0].score, 0);
  assert.deepEqual(zero.errors, []);
});

test('a missing batch item preserves successful siblings; persistence failure propagates', async t => {
  t.mock.method(AIService as any, 'getSetting', async () => 'test');
  t.mock.method(AIService as any, 'callMatchText', async () => JSON.stringify({ curated: [llm()] }));
  const result = await AIService.curateOffersBatch({ ...input, offers: [offer, { ...offer, id: 'offer2' }] });
  assert.deepEqual(result.curated.map(item => item.id), ['offer1']);
  assert.deepEqual(result.errors.map(item => item.id), ['offer2']);
  await assert.rejects(AIService.curateOffersBatch({ ...input, onBatchComplete: async () => { throw new Error('DB_WRITE_FAILED'); } }), /DB_WRITE_FAILED/);
});

test('generation and source guards reject stale writes but allow valid zero', () => {
  const guard = { sourceHash: 'a', currentSourceHash: 'a', startedAt: new Date('2026-09-15T12:00:00Z'), previousStartedAt: null, score: 0 };
  assert.equal(mayPersistMatch(guard), true);
  assert.equal(mayPersistMatch({ ...guard, currentSourceHash: 'b' }), false);
  assert.equal(mayPersistMatch({ ...guard, previousStartedAt: new Date('2026-09-15T12:01:00Z') }), false);
  assert.equal(mayPersistMatch({ ...guard, startedAt: new Date('invalid') }), false);
});
