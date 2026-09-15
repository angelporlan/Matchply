import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateEvidence, buildMatchExplanationPrompt, buildOfferCard, emptyBreakdown, isMatchDetails, isMatchEvidenceSnapshot, normalizeMatchDetails, normalizeMatchItem, type CandidateEvidence, type MatchRequirement } from '@/lib/matching';
import { parseMatchConstraints } from '@/lib/curation-constraints';

function candidate(skills = ['React', 'Node.js'], years: number | null = 3, cv = '') {
  return buildCandidateEvidence({ skills: skills.map((name) => ({ name, category: 'other', proficiency: 'core' })), ...(years !== null ? { experienceYears: years } : {}) }, cv, {});
}
function req(overrides: Partial<MatchRequirement> = {}): MatchRequirement {
  return { id: 'r1', name: 'Golang', kind: 'skill', importance: 'required', core: true, status: 'missing', offerEvidence: { sourceId: 'offer', quote: 'Golang required for production backend development.' }, candidateEvidence: [], alternatives: [], ...overrides };
}
function evaluate(description: string, requirements: MatchRequirement[], c: CandidateEvidence = candidate(), options: { title?: string; dimensions?: ReturnType<typeof emptyBreakdown>; constraints?: ReturnType<typeof parseMatchConstraints> } = {}) {
  const offer = { id: 'offer', title: options.title ?? 'Engineer', company: 'Acme', description };
  return normalizeMatchItem({ offer, offerCard: buildOfferCard(offer, 'triage'), candidateEvidence: c, candidateCard: c.card, constraints: options.constraints ?? {}, targetThreshold: 65, kind: 'triage', model: 'test', llm: { id: 'offer', ...(options.dimensions ?? emptyBreakdown(90)), requirements } });
}
const goDescription = 'Requirements\nGolang required for production backend development.';

test('required missing core technology caps stack35 and global59 regardless of language name', () => {
  for (const technology of ['Golang', 'Rust', 'Java', 'TypeScript', 'Kotlin']) {
    const sentence = `${technology} required for production backend development.`;
    const evaluated = evaluate(`Requirements\n${sentence}`, [req({ name: technology, offerEvidence: { sourceId: 'offer', quote: sentence } })], candidate(['React']));
    assert.equal(evaluated.score, 59);
    assert.equal(evaluated.scoreBreakdown.tech_stack, 35);
    assert.equal(evaluated.evidence.baseScore, 90);
    assert.equal(isMatchEvidenceSnapshot(evaluated.evidence), true);
  }
});

test('Golang expert and alternative accepted stack are never rejected by a language blacklist', () => {
  const expert = evaluate(goDescription, [req({ status: 'met', candidateEvidence: [{ sourceId: 'profile', quote: 'Golang' }] })], candidate(['Golang']));
  assert.equal(expert.score, 90);
  const alternative = 'Golang or Node.js required for production backend development.';
  const matched = evaluate(`Requirements\n${alternative}`, [req({ offerEvidence: { sourceId: 'offer', quote: alternative }, alternatives: ['Golang', 'Node.js'] })]);
  assert.equal(matched.score, 90);
  assert.equal(matched.evidence.requirements[0].status, 'unknown');
});

test('nice-to-have and incomplete candidate sources cannot trigger missing-core cap', () => {
  const optional = 'Golang is optional, a plus for production backend development.';
  assert.equal(evaluate(`Preferred qualifications\n${optional}`, [req({ offerEvidence: { sourceId: 'offer', quote: optional } })]).score, 90);
  const incomplete = { ...candidate(), complete: false };
  const evaluated = evaluate(goDescription, [req()], incomplete);
  assert.equal(evaluated.score, 90);
  assert.equal(evaluated.evidence.requirements[0].status, 'unknown');
});

test('seven required AI years versus three total years proves gap without inventing AI years', () => {
  const sentence = '7 years in AI production required for this engineering position.';
  const evaluated = evaluate(`Requirements\n${sentence}`, [req({ name: 'AI experience', kind: 'experience', status: 'met', offerEvidence: { sourceId: 'offer', quote: sentence }, requiredYears: 7, candidateYears: 3, experienceScope: 'ai', candidateExperienceScope: 'overall', candidateEvidence: [{ sourceId: 'profile', quote: '"experienceYears":3' }] })]);
  assert.equal(evaluated.score, 59);
  assert.equal(evaluated.scoreBreakdown.experience_fit, 40);
  assert.equal(evaluated.evidence.requirements[0].status, 'partial');
  assert.equal(evaluated.evidence.requirements[0].candidateYearsIsUpperBound, true);
  assert.match(evaluated.evidence.adjustments[0].reason, /límite superior/);
});

test('unknown years and total years above requirement do not invent specialized years', () => {
  const sentence = '7 years in AI production required for this engineering position.';
  const requirement = req({ name: 'AI experience', kind: 'experience', status: 'unknown', offerEvidence: { sourceId: 'offer', quote: sentence }, requiredYears: 7, experienceScope: 'ai' });
  assert.equal(evaluate(`Requirements\n${sentence}`, [requirement], candidate(['React'], null)).score, 90);
  assert.equal(evaluate(`Requirements\n${sentence}`, [requirement], candidate(['React'], 12)).score, 90);
});

test('comparable domain years apply gap; unsupported model scope cannot compare unrelated years', () => {
  const sentence = '7 years in AI production required for this engineering position.';
  const cv = '## Experience\nI have 2 years in AI production building retrieval systems, with 12 years in overall professional software development.';
  const requirement = req({ name: 'AI experience', kind: 'experience', status: 'partial', offerEvidence: { sourceId: 'offer', quote: sentence }, candidateEvidence: [{ sourceId: 'cv', quote: '2 years in AI production' }], requiredYears: 7, candidateYears: 2, experienceScope: 'ai', candidateExperienceScope: 'ai' });
  assert.equal(evaluate(`Requirements\n${sentence}`, [requirement], candidate(['React'], 12, cv)).score, 59);
  const unrelated = { ...requirement, candidateEvidence: [{ sourceId: 'cv', quote: '2 years in Java development' }] };
  assert.equal(evaluate(`Requirements\n${sentence}`, [unrelated], candidate(['React'], 12, '## Experience\nI have 2 years in Java development and 12 years of overall professional software development.')).score, 90);
});

test('a range uses its lower bound and malformed quote cannot supply upper bound years', () => {
  const sentence = '6-8 years in AI production required for this engineering position.';
  const requirement = req({ name: 'AI experience', kind: 'experience', status: 'unknown', offerEvidence: { sourceId: 'offer', quote: sentence }, requiredYears: 8, experienceScope: 'ai' });
  assert.throws(() => evaluate(`Requirements\n${sentence}`, [requirement], candidate(['React'], 4)), /mínimo de años/);
  assert.equal(evaluate(`Requirements\n${sentence}`, [{ ...requirement, requiredYears: 6 }], candidate(['React'], 4)).score, 90);
});

test('Staff title alone has no automatic ceiling', () => {
  const sentence = 'Staff Engineer required to build an early-stage customer platform.';
  const evaluated = evaluate(sentence, [req({ name: 'Staff Engineer', kind: 'seniority', offerEvidence: { sourceId: 'offer', quote: sentence } })], candidate(), { title: 'Staff Engineer' });
  assert.equal(evaluated.score, 90);
});

test('English requirement only changes score with an explicit user rule', () => {
  const sentence = 'English C1 required for customer-facing software development.';
  const requirement = req({ name: 'English', kind: 'language', offerEvidence: { sourceId: 'offer', quote: sentence } });
  const noRule = parseMatchConstraints({ englishLevel: 'b1' });
  assert.equal(evaluate(sentence, [requirement], candidate(), { constraints: noRule }).score, 90);
  const explicit = parseMatchConstraints({ curationCriteria: 'Penaliza si exigen inglés C1 o C2.' });
  const evaluated = evaluate(sentence, [requirement], candidate(), { constraints: explicit });
  assert.equal(evaluated.score, 40);
  assert.equal(evaluated.evidence.adjustments[0].code, 'user_preference');
});

test('invalid quotes, wrong skill evidence and incomplete offers fail instead of receiving a score', () => {
  assert.throws(() => evaluate(goDescription, [req({ offerEvidence: { sourceId: 'offer', quote: 'Unseen fabricated obligation' } })]));
  assert.throws(() => evaluate(goDescription, [req({ name: 'COBOL' })]));
  assert.throws(() => evaluate(goDescription, [req({ status: 'met', candidateEvidence: [{ sourceId: 'profile', quote: 'React' }] })]));
  assert.throws(() => evaluate(`Requirements\n${'Golang required in this production backend role. '.repeat(800)}`, [req()]));
});

test('deep explanation preserves score and validates all requirement references', () => {
  const evaluated = evaluate(goDescription, [req()]);
  const details = { summary: 'Falta experiencia acreditada en el núcleo requerido.', dimensions: Object.keys(evaluated.scoreBreakdown).map((key) => ({ key, explanation: 'Explicación basada en la evaluación guardada.', requirementIds: ['r1'] })), requirements: [{ requirementId: 'r1', explanation: 'Golang obligatorio no aparece en las fuentes completas.' }], nextSteps: ['Comprueba si aceptan experiencia equivalente.'] };
  const normalized = normalizeMatchDetails(details, evaluated.evidence);
  assert.equal(isMatchDetails(normalized, evaluated.evidence), true);
  assert.equal(normalized.inputHash, evaluated.inputHash);
  assert.equal(evaluated.score, 59);
  assert.throws(() => normalizeMatchDetails({ ...details, requirements: [{ requirementId: 'fabricated', explanation: '' }] }, evaluated.evidence));
  assert.throws(() => normalizeMatchDetails({ ...details, requirements: [] }, evaluated.evidence));
  assert.match(buildMatchExplanationPrompt(evaluated.evidence).systemPrompt, /No cambies ni recalcules score/);
});


test('negative skill statements cannot substantiate met', () => {
  const c = candidate(['React'], 3, '## Experience\nNo tengo experiencia con Golang. Trabajo con React en aplicaciones web de producción.');
  assert.throws(() => evaluate(goDescription, [req({ status: 'met', candidateEvidence: [{ sourceId: 'cv', quote: 'No tengo experiencia con Golang.' }] })], c), /evidencia profesional/);
});

test('omitted mandatory sentences, technologies and years cannot receive a high score', () => {
  const react = req({ name: 'React', status: 'met', offerEvidence: { sourceId: 'offer', quote: 'React required for frontend.' }, candidateEvidence: [{ sourceId: 'profile', quote: 'React' }] });
  assert.throws(() => evaluate('Requirements\nReact required for frontend.\nGolang mandatory for backend with 4 years of experience.', [react]), /omitió evidencia/);
  const combined = 'React and Golang required for full stack production development.';
  assert.throws(() => evaluate(combined, [{ ...react, offerEvidence: { sourceId: 'offer', quote: combined } }]), /omitió una competencia/);
  const years = 'Golang required with 4 years of backend production experience.';
  assert.throws(() => evaluate(years, [req({ offerEvidence: { sourceId: 'offer', quote: years } })]), /mínimo de años/);
});


test('negation about a different skill does not erase positive experience', () => {
  const sentence = 'React required for production frontend applications.';
  const c = candidate(['React'], 3, '## Experience\nReact production development, not Angular. I build customer-facing applications.');
  const evaluated = evaluate(sentence, [req({ name: 'React', status: 'met', offerEvidence: { sourceId: 'offer', quote: sentence }, candidateEvidence: [{ sourceId: 'cv', quote: 'React production development, not Angular.' }] })], c);
  assert.equal(evaluated.score, 90);
});


test('ordinary English go does not create an imaginary language requirement', () => {
  const sentence = 'You must go to the office to collaborate with the product team.';
  const evaluated = evaluate(sentence, [req({ name: 'Office attendance', kind: 'other', core: false, status: 'unknown', offerEvidence: { sourceId: 'offer', quote: sentence } })]);
  assert.equal(evaluated.score, 90);
  assert.throws(() => evaluate(sentence, [req({ name: 'Go', offerEvidence: { sourceId: 'offer', quote: sentence } })]), /competencia no aparece/);
});

test('English go in the CV cannot suppress a real missing Golang requirement', () => {
  const c = candidate(['React'], 3, '## Experience\nI go to the office to work on React production applications with the product team.');
  const evaluated = evaluate(goDescription, [req()], c);
  assert.equal(evaluated.scoreBreakdown.tech_stack, 35);
  assert.equal(evaluated.score, 59);
});

test('technical Go aliases and Java retain mandatory coverage checks', () => {
  for (const sentence of ['Go required for backend production development.', 'Golang required for backend production development.', 'go programming required for backend production development.', 'Java required for backend production development.']) {
    assert.throws(() => evaluate(sentence, [req({ name: 'Backend work', kind: 'other', core: false, status: 'unknown', offerEvidence: { sourceId: 'offer', quote: sentence } })]), /omitió una competencia/);
  }
});
