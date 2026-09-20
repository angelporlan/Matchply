import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateEvidence, buildOfferCard, canReuseCachedMatch, cachedMatchItem, isMatchEvidenceSnapshot, matchInputHash, matchSourceHash, normalizeMatchItem, type LlmMatchItem } from '@/lib/matching';

const offer = { id: 'off', title: 'Backend Engineer', company: 'Acme', description: 'Requirements\nNode.js required for production backend development.' };
const candidate = buildCandidateEvidence({ skills: [{ name: 'Node.js', category: 'backend', proficiency: 'core' }], experienceYears: 3 }, '', {});
const card = buildOfferCard(offer, 'triage');
const llm: LlmMatchItem = {
  id: 'off', tech_stack: 90, experience_fit: 80, work_mode: 80, salary_fit: 50, career_alignment: 90,
  requirements: [{ id: 'r1', name: 'Node.js', kind: 'skill', importance: 'required', core: true, status: 'met', offerEvidence: { sourceId: 'offer', quote: 'Node.js required for production backend development.' }, candidateEvidence: [{ sourceId: 'profile', quote: 'Node.js' }], alternatives: [] }],
};
function result() { return normalizeMatchItem({ offer, offerCard: card, candidateCard: candidate.card, candidateEvidence: candidate, llm, constraints: {}, targetThreshold: 65, kind: 'triage', model: 'test', provider: 'test' }); }

test('source hash covers complete source changes, but excludes mode, model and generated prose', () => {
  const base = matchSourceHash({ candidateEvidence: candidate, offerCard: card, constraints: {} });
  assert.equal(base, matchSourceHash({ candidateEvidence: candidate, offerCard: buildOfferCard({ ...offer, tldr: 'Old result' }, 'deep'), constraints: {} }));
  const modifiedProfile = buildCandidateEvidence({ skills: [{ name: 'Node.js', category: 'backend', proficiency: 'core' }], experienceYears: 4 }, '', {});
  assert.notEqual(base, matchSourceHash({ candidateEvidence: modifiedProfile, offerCard: card, constraints: {} }));
  const hiddenTail = buildOfferCard({ ...offer, description: `${offer.description}\nBenefits\n${'Coffee. '.repeat(3000)}A changed source fact.` }, 'triage');
  assert.notEqual(base, matchSourceHash({ candidateEvidence: candidate, offerCard: hiddenTail, constraints: {} }));
  const changedCv = buildCandidateEvidence({ skills: [{ name: 'Node.js', category: 'backend', proficiency: 'core' }], experienceYears: 3 }, 'Additional CV experience in Go.', {});
  assert.notEqual(base, matchSourceHash({ candidateEvidence: changedCv, offerCard: card, constraints: {} }));
});

test('score fingerprint is shared between triage/deep and changes with provider/model/preferences', () => {
  const input = { candidateEvidence: candidate, offerCard: card, constraints: {}, provider: 'p', model: 'm' };
  const base = matchInputHash({ ...input, kind: 'triage' });
  assert.equal(base, matchInputHash({ ...input, kind: 'deep' }));
  assert.notEqual(base, matchInputHash({ ...input, provider: 'q' }));
  assert.notEqual(base, matchInputHash({ ...input, model: 'n' }));
  assert.notEqual(base, matchInputHash({ ...input, constraints: { salaryMin: 90000 } }));
});

test('cache requires verified matching snapshot; legacy and fake fallback scores never qualify', () => {
  const evaluated = result();
  assert.equal(isMatchEvidenceSnapshot(evaluated.evidence), true);
  const input = { hash: evaluated.inputHash, cachedHash: evaluated.inputHash, scoreOverall: evaluated.score, scoreBreakdown: evaluated.scoreBreakdown, hasDescription: true, canonicalBreakdown: true, evidence: evaluated.evidence };
  assert.equal(canReuseCachedMatch(input), true);
  assert.equal(canReuseCachedMatch({ ...input, evidence: undefined }), false);
  assert.equal(canReuseCachedMatch({ ...input, cachedHash: 'stale' }), false);
  assert.equal(canReuseCachedMatch({ ...input, scoreOverall: 50 }), false);
  assert.equal(canReuseCachedMatch({ ...input, evidence: { ...evaluated.evidence, requirements: [] } }), false);
  const cached = cachedMatchItem({ offer, score: evaluated.score, scoreBreakdown: evaluated.scoreBreakdown, hash: evaluated.inputHash, kind: 'deep', targetThreshold: 65, evidence: evaluated.evidence });
  assert.equal(cached.score, evaluated.score);
  assert.equal(cached.details, undefined);
});

test('missing model item, missing dimension and invalid evidence cannot become 50', () => {
  const input = { offer, offerCard: card, candidateCard: candidate.card, candidateEvidence: candidate, constraints: {}, targetThreshold: 65, kind: 'triage' as const, model: 'test' };
  assert.throws(() => normalizeMatchItem({ ...input, llm: null }));
  assert.throws(() => normalizeMatchItem({ ...input, llm: { ...llm, experience_fit: undefined } }));
  assert.throws(() => normalizeMatchItem({ ...input, llm: { ...llm, requirements: [] } }));
  assert.throws(() => normalizeMatchItem({ ...input, llm: { ...llm, id: 'other' } }));
});

test('explicit rejection stays rejected when a cached result is requested with a lower threshold', () => {
  const remoteCandidate = buildCandidateEvidence({ skills: [{ name: 'Node.js', category: 'backend', proficiency: 'core' }], preferredWorkplaces: ['remote'] }, '', { workplace: { remoteOnly: true } });
  const onsiteOffer = { ...offer, description: `${offer.description}\nLocation: onsite office.` };
  const evaluated = normalizeMatchItem({ offer: onsiteOffer, offerCard: buildOfferCard(onsiteOffer, 'triage'), candidateCard: remoteCandidate.card, candidateEvidence: remoteCandidate, llm: { ...llm, tech_stack: 20, experience_fit: 20, work_mode: 20, salary_fit: 20, career_alignment: 20 }, constraints: { workplace: { remoteOnly: true } }, targetThreshold: 65, kind: 'triage', model: 'test' });
  assert.equal(evaluated.evidence.rejectedByPreference, true);
  const cached = cachedMatchItem({ offer: onsiteOffer, score: evaluated.score, scoreBreakdown: evaluated.scoreBreakdown, hash: evaluated.inputHash, evidence: evaluated.evidence, kind: 'triage', targetThreshold: 0 });
  assert.equal(cached.decision, 'archive');
});
