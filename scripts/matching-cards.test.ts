import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidateCard, buildCandidateEvidence, buildMatchSystemPrompt, buildMatchUserPrompt, buildOfferCard, extractOfferSalaryMax } from '@/lib/matching';
import { parseMatchConstraints } from '@/lib/curation-constraints';

const offer = { id: 'off', title: 'Developer', company: 'Acme' };

test('extracts all requirements across plain, bold and emoji headings while removing benefits', () => {
  const card = buildOfferCard({ ...offer, description: `About us\nWe sell excellent software to everyone.\n✅ What we are looking for\nTypeScript and Node.js required for backend development.\n**Qué ofrecemos**\nFruit and coffee every morning.\nSalario: 40.000€\n### Perfil buscado\nExperiencia obligatoria de 5 años desarrollando APIs.\nEqual Opportunity\nWe welcome applications from everyone.` }, 'triage');
  assert.match(card.requirementsExtract, /TypeScript/);
  assert.match(card.requirementsExtract, /5 años/);
  assert.match(card.requirementsExtract, /40.000/);
  assert.doesNotMatch(card.requirementsExtract, /coffee|sell excellent|welcome applications/);
  assert.equal(card.complete, true);
});

test('keeps a mandatory requirement in the middle instead of taking only head and tail', () => {
  const card = buildOfferCard({ ...offer, description: `${'Company introduction. '.repeat(80)}\nRequirements\nGolang required, 4+ years building production APIs.\nBenefits\n${'Fruit and coffee. '.repeat(100)}` }, 'triage');
  assert.match(card.requirementsExtract, /Golang required/);
  assert.doesNotMatch(card.requirementsExtract, /Fruit and coffee/);
});

test('oversized relevant evidence is flagged incomplete and never silently sliced into a valid offer', () => {
  const card = buildOfferCard({ ...offer, description: `Requirements\n${'TypeScript required for production systems. '.repeat(500)}` }, 'triage');
  assert.equal(card.complete, false);
  assert.ok(card.requirementsExtract.length <= 14000);
});

test('triage and deep see identical input facts and ignore generated tldr', () => {
  const input = { ...offer, description: 'Requirements\nTypeScript is required for building customer facing applications.', tldr: 'Previous model says poor fit.' };
  const triage = buildOfferCard(input, 'triage');
  assert.deepEqual(triage, buildOfferCard(input, 'deep'));
  assert.deepEqual(triage, buildOfferCard({ ...input, tldr: 'Previous model says perfect fit.' }, 'triage'));
});

test('candidate preserves years, explicit criteria and CV evidence beyond the structured skills', () => {
  const profile = {
    experienceYears: 2, englishLevel: 'b2', curationCriteria: 'Prioriza puestos individuales sin gestión.',
    skills: Array.from({ length: 20 }, (_, index) => ({ name: `Technology ${index}`, category: 'other', proficiency: 'solid', evidence: 'Production evidence '.repeat(5) })),
    keyProjects: [{ title: 'Acme', kind: 'experience', role: 'Developer', period: '2023–2026', description: 'Building production APIs.' }],
  };
  const candidate = buildCandidateEvidence(profile, '## Habilidades\n- COBOL\n## Experiencia\nDesarrollo bancario desde 2023 hasta 2026.', {});
  assert.equal(candidate.complete, true);
  assert.match(candidate.card, /Años de experiencia: 2/);
  assert.match(candidate.card, /Prioriza puestos individuales/);
  assert.match(candidate.card, /b2/);
  assert.match(candidate.card, /Technology 19/);
  assert.match(candidate.card, /COBOL/);
  assert.match(candidate.card, /2023–2026/);
  assert.match(candidate.card, /Developer/);
});

test('unknown years stay unknown and truncated candidate retains protected preferences', () => {
  const candidate = buildCandidateEvidence({ skills: [{ name: 'React', category: 'frontend', proficiency: 'solid' }], bio: 'Long evidence '.repeat(200), curationCriteria: 'Prioriza trabajo de producto.' }, '', {}, 600);
  assert.equal(candidate.complete, false);
  assert.equal(candidate.totalExperienceYears, null);
  assert.match(candidate.card, /Años de experiencia: desconocido/);
  assert.match(candidate.card, /Prioriza trabajo de producto/);
});

test('prompt provides scoring evidence sources and no narrative response fields', () => {
  const constraints = parseMatchConstraints({});
  const candidate = buildCandidateEvidence({ skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }] }, '', constraints);
  const system = buildMatchSystemPrompt({ kind: 'triage', targetThreshold: 65 });
  const user = buildMatchUserPrompt({ candidateCard: candidate.card, candidateEvidence: candidate, offers: [buildOfferCard({ ...offer, description: 'Requirements\nReact required for production customer-facing applications.' }, 'triage')] });
  assert.match(system, /IDIOMAS: no penalices nunca/);
  assert.doesNotMatch(system, /"fitReason"|"highlightSkills"|"verdict"/);
  assert.match(system, /"requirements"/);
  assert.match(user, /fuente:profile/);
  assert.doesNotMatch(user, /Previous model/);
  assert.equal(buildCandidateCard({}, '', {}), buildCandidateEvidence({}, '', {}).card);
});

test('extractOfferSalaryMax reads k-suffix and euro ranges', () => {
  assert.equal(extractOfferSalaryMax('45k-60k €'), 60000);
  assert.equal(extractOfferSalaryMax('Salario: 50.000€ brutos'), 50000);
  assert.equal(extractOfferSalaryMax('Equipo joven y dinámico'), null);
});


test('raw source beyond normalizer skill limits still changes the fingerprint and is available', () => {
  const skills = Array.from({ length: 45 }, (_, index) => ({ name: `Skill ${index}`, category: 'other', proficiency: 'solid' }));
  const a = buildCandidateEvidence({ skills }, '', {});
  const b = buildCandidateEvidence({ skills: [...skills.slice(0, 44), { ...skills[44], name: 'Another skill' }] }, '', {});
  assert.match(a.card, /Skill 44/);
  assert.notEqual(a.sourceHash, b.sourceHash);
});

test('inactive language preferences stay out of the active scoring prompt', () => {
  const profile = { skills: [{ name: 'React', category: 'frontend', proficiency: 'core' }], curationCriteria: 'Penaliza ofertas en inglés. Prioriza trabajo de producto.', scoringPreferences: { version: 1, languageRules: [], reviewRequired: ['Penaliza ofertas en inglés'] } };
  const card = buildCandidateEvidence(profile, '', parseMatchConstraints(profile)).card;
  assert.doesNotMatch(card, /Penaliza ofertas en inglés|reviewRequired|preferenceReviewRequired/);
  assert.match(card, /Prioriza trabajo de producto/);
});


test('invalid legacy years are unknown rather than zero or one', () => {
  for (const experienceYears of [undefined, null, '', '   ', true, false, '2-3']) {
    assert.equal(buildCandidateEvidence({ experienceYears }, '', {}).totalExperienceYears, null);
  }
  assert.equal(buildCandidateEvidence({ experienceYears: 0 }, '', {}).totalExperienceYears, 0);
  assert.equal(buildCandidateEvidence({ experienceYears: ' 3 ' }, '', {}).totalExperienceYears, 3);
});
