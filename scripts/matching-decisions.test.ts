import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '@/lib/ai-service';
import {
  MATCH_DIMENSION_KEYS,
  buildCandidateEvidence,
  buildMatchDecision,
  buildOfferCard,
  decisionScoreToPercent,
  llmItemFromDecision,
  normalizeMatchItem,
  type DecisionAnswer,
} from '@/lib/matching';

const profile = { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 };
const reactOffer = { id: 'offer1', title: 'Frontend', company: 'Acme', description: 'Requirements\nReact is required for building customer interfaces.' };

function answersFor(questions: Array<{ type: string; name: string }>, choice = 'met', score = 4): DecisionAnswer[] {
  return questions.map((question) => question.type === 'score'
    ? { type: 'score', name: question.name, score }
    : { type: 'choice', name: question.name, choice });
}

test('decision levels map the weighted index onto 0–100 and reject a raw percentage', () => {
  assert.equal(decisionScoreToPercent(0), 0);
  assert.equal(decisionScoreToPercent(1), 25);
  assert.equal(decisionScoreToPercent(2), 50);
  assert.equal(decisionScoreToPercent(4), 100);
  assert.equal(decisionScoreToPercent(1.5), 38);
  assert.throws(() => decisionScoreToPercent(80), /cinco dimensiones/);
  assert.throws(() => decisionScoreToPercent(Number.NaN), /cinco dimensiones/);
});

test('host quotes cover the offer and Decisions only classifies them', () => {
  const candidate = buildCandidateEvidence(profile, '', {});
  const offer = buildOfferCard(reactOffer, 'triage');
  const decision = buildMatchDecision({ candidate, offer });
  assert.equal(decision.questions.filter((question) => question.type === 'score').length, 5);
  assert.ok(decision.shells.some((shell) => shell.kind === 'skill' && shell.name === 'React'));
  assert.match(decision.input, /Acme/);
  const item = normalizeMatchItem({
    offer: reactOffer, offerCard: offer, candidateCard: candidate.card, candidateEvidence: candidate,
    llm: llmItemFromDecision({ offerId: offer.id, shells: decision.shells, candidate, answers: answersFor(decision.questions) }),
    constraints: {}, targetThreshold: 65, kind: 'triage', model: 'gpt-6-luna', provider: 'openai', scoringMethod: 'decisions-v1',
  });
  assert.equal(item.score, 100);
  assert.equal(item.evidence.requirements[0].status, 'met');
  assert.equal(item.evidence.requirements[0].offerEvidence.quote.includes('React is required'), true);
});

test('a missing core skill still caps the score when Decisions says missing', () => {
  const description = 'Requirements\nGolang required for production backend development.';
  const candidate = buildCandidateEvidence({ skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 6 }, '', {});
  const offer = buildOfferCard({ id: 'offer', title: 'Backend', company: 'Acme', description }, 'triage');
  const decision = buildMatchDecision({ candidate, offer });
  const skill = decision.shells.find((shell) => shell.kind === 'skill');
  assert.equal(skill?.name, 'Go');
  const item = normalizeMatchItem({
    offer: { id: 'offer', title: 'Backend', company: 'Acme' }, offerCard: offer, candidateCard: candidate.card, candidateEvidence: candidate,
    llm: llmItemFromDecision({ offerId: 'offer', shells: decision.shells, candidate, answers: answersFor(decision.questions, 'missing', 4) }),
    constraints: {}, targetThreshold: 65, kind: 'triage', model: 'gpt-6-luna', provider: 'openai', scoringMethod: 'decisions-v1',
  });
  assert.equal(item.scoreBreakdown.tech_stack, 35);
  assert.equal(item.score, 59);
});

test('an or-requirement does not cap when one alternative is already in the profile', () => {
  const description = 'Requirements\nGolang or Node.js required for production backend development.';
  const candidate = buildCandidateEvidence({ skills: [{ name: 'Node.js', category: 'backend', proficiency: 'core' }], experienceYears: 4 }, '', {});
  const offer = buildOfferCard({ id: 'offer', title: 'Backend', company: 'Acme', description }, 'triage');
  const decision = buildMatchDecision({ candidate, offer });
  const skill = decision.shells.find((shell) => shell.kind === 'skill');
  assert.equal(decision.shells.filter((shell) => shell.kind === 'skill').length, 1);
  assert.deepEqual([skill?.name, ...(skill?.alternatives ?? [])].sort(), ['Go', 'Node.js']);
  const item = normalizeMatchItem({
    offer: { id: 'offer', title: 'Backend', company: 'Acme' }, offerCard: offer, candidateCard: candidate.card, candidateEvidence: candidate,
    llm: llmItemFromDecision({ offerId: 'offer', shells: decision.shells, candidate, answers: answersFor(decision.questions, 'missing', 4) }),
    constraints: {}, targetThreshold: 65, kind: 'triage', model: 'gpt-6-luna', provider: 'openai', scoringMethod: 'decisions-v1',
  });
  assert.equal(item.score, 100);
  assert.equal(item.evidence.requirements.find((requirement) => requirement.kind === 'skill')?.status, 'unknown');
});

test('years stay on the host: seven required years against three total years still cap experience', () => {
  const description = 'Requirements\n7 years in AI production required for this engineering position.';
  const candidate = buildCandidateEvidence({ skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], experienceYears: 3 }, '', {});
  const offer = buildOfferCard({ id: 'offer', title: 'AI Engineer', company: 'Acme', description }, 'triage');
  const decision = buildMatchDecision({ candidate, offer });
  assert.equal(decision.shells.some((shell) => shell.kind === 'experience' && shell.requiredYears === 7), true);
  const item = normalizeMatchItem({
    offer: { id: 'offer', title: 'AI Engineer', company: 'Acme' }, offerCard: offer, candidateCard: candidate.card, candidateEvidence: candidate,
    llm: llmItemFromDecision({ offerId: 'offer', shells: decision.shells, candidate, answers: answersFor(decision.questions, 'met', 4) }),
    constraints: {}, targetThreshold: 65, kind: 'triage', model: 'gpt-6-luna', provider: 'openai', scoringMethod: 'decisions-v1',
  });
  assert.equal(item.scoreBreakdown.experience_fit, 40);
  assert.equal(item.score, 59);
});

test('a single paragraph still produces a requirement and the score sees the whole offer', () => {
  const paragraph = `${'Behind every successful shipment is a well-organized manufacturing process. '.repeat(8)}At Zenova, every enclosure goes through quality control.`;
  const candidate = buildCandidateEvidence(profile, '', {});
  const raw = { id: 'zenova', title: 'Manufacturing', company: 'Zenova', description: paragraph };
  const offer = buildOfferCard(raw, 'triage');
  const decision = buildMatchDecision({ candidate, offer });
  assert.ok(decision.shells.length >= 1);
  assert.match(decision.input, /quality control/);
  const item = normalizeMatchItem({
    offer: raw, offerCard: offer, candidateCard: candidate.card, candidateEvidence: candidate,
    llm: llmItemFromDecision({ offerId: offer.id, shells: decision.shells, candidate, answers: answersFor(decision.questions, 'unknown', 2) }),
    constraints: {}, targetThreshold: 65, kind: 'triage', model: 'gpt-6-luna', provider: 'openai', scoringMethod: 'decisions-v1',
  });
  assert.equal(item.score, 50);
});

test('a refused dimension fails the offer instead of inventing a middle score', () => {
  const candidate = buildCandidateEvidence(profile, '', {});
  const offer = buildOfferCard(reactOffer, 'triage');
  const decision = buildMatchDecision({ candidate, offer });
  assert.throws(() => llmItemFromDecision({
    offerId: offer.id, shells: decision.shells, candidate,
    answers: [{ type: 'refusal', name: 'tech_stack' }],
  }), /cinco dimensiones/);
});

test('openai matching scores with Decisions and explains the cached result in text', async (t) => {
  t.mock.method(AIService as any, 'routeModel', async () => ({ provider: 'openai', model: 'gpt-4o' }));
  let decisions = 0;
  let texts = 0;
  t.mock.method(AIService as any, 'callOpenAIDecisions', async (_input: string, questions: Array<{ type: string; name: string }>) => {
    decisions += 1;
    assert.ok(questions.length <= 12);
    assert.equal(questions.filter((question) => question.type === 'score').length, MATCH_DIMENSION_KEYS.length);
    return answersFor(questions);
  });
  t.mock.method(AIService as any, 'callMatchText', async (_provider: string, model: string, system: string, user: string) => {
    texts += 1;
    assert.equal(model, 'gpt-6-luna');
    const snapshot = JSON.parse(user);
    return JSON.stringify({
      summary: 'Competencia acreditada.',
      dimensions: MATCH_DIMENSION_KEYS.map((key) => ({ key, explanation: 'Según la evidencia.', requirementIds: [snapshot.requirements[0].id] })),
      requirements: snapshot.requirements.map((requirement: { id: string }) => ({ requirementId: requirement.id, explanation: 'React figura en el perfil.' })),
      nextSteps: ['Revisar la oferta.'],
    });
  });
  const input = { baseCvMarkdown: '', userCareerProfile: profile, offers: [reactOffer], userSubscriptionStatus: 'active' };
  const first = (await AIService.curateOffersBatch(input)).curated[0];
  assert.equal(decisions, 1);
  assert.equal(texts, 0);
  assert.equal(first.score, 100);
  const cached = { ...reactOffer, scoreOverall: first.score, scoreBreakdown: first.scoreBreakdown, matchInputHash: first.inputHash, matchEvidence: first.evidence };
  const deep = (await AIService.curateOffersBatch({ ...input, offers: [cached], kind: 'deep' })).curated[0];
  assert.equal(decisions, 1);
  assert.equal(texts, 1);
  assert.equal(deep.score, first.score);
  assert.equal(deep.details?.summary, 'Competencia acreditada.');
});
