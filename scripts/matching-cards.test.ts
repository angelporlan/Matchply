import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCandidateCard,
  buildMatchSystemPrompt,
  buildMatchUserPrompt,
  buildOfferCard,
  extractOfferSalaryMax,
} from '@/lib/matching';
import { parseMatchConstraints } from '@/lib/curation-constraints';

test('offer card prefers the requirements section over the company preamble', () => {
  const card = buildOfferCard({
    id: 'off-1',
    title: 'Backend Engineer',
    company: 'Acme',
    description: `
Acme is a wonderful company founded in 1998 with offices worldwide and a great culture.

## Requisitos
- TypeScript y Node.js
- 5 años de experiencia
- Salario 40.000€

## Beneficios
- Fruta
- Seguro médico
`.trim(),
  }, 'triage');

  assert.match(card.requirementsExtract, /TypeScript/);
  assert.doesNotMatch(card.requirementsExtract, /wonderful company founded in 1998/);
  assert.equal(card.salaryMax, 40000);
  assert.equal(card.workplace, 'unknown');
});

test('offer card falls back to head+tail when there is no requirements heading', () => {
  const body = `${'A'.repeat(800)} salario 60k ${'B'.repeat(800)} must know Kubernetes`;
  const card = buildOfferCard({
    id: 'off-2',
    title: 'SRE',
    company: 'Orb',
    description: body,
  }, 'triage');
  assert.match(card.requirementsExtract, /Kubernetes/);
  assert.match(card.requirementsExtract, /\[…\]/);
});

test('candidate card does not dump master document and raw CV together', () => {
  const constraints = parseMatchConstraints({
    curationCriteria: 'Descarta ofertas en inglés.',
    preferredWorkplaces: ['remote'],
    salaryMin: 50000,
  });
  const card = buildCandidateCard({
    skills: [{ name: 'TypeScript', category: 'frontend', proficiency: 'core', evidence: '3 años en Acme' }],
    techStack: { frontend: ['React'] },
    keyProjects: [{ title: 'Plataforma X', description: 'APIs Node', kind: 'experience' }],
    masterDocument: 'Documento maestro muy largo que no debe repetirse junto al CV.',
    bio: 'Bio larga que duplicaría el master.',
    preferredWorkplaces: ['remote'],
    salaryMin: 50000,
    targetRoles: ['Backend'],
  }, '# Persona\n## Habilidades\n- COBOL\n## Experiencia\n- Banco 1999', constraints);

  assert.match(card, /TypeScript/);
  assert.match(card, /Solo remoto/);
  assert.doesNotMatch(card, /COBOL/);
  assert.doesNotMatch(card, /Documento maestro muy largo/);
});

test('system prompt has no few-shot high score and user prompt does not repeat the rubric', () => {
  const system = buildMatchSystemPrompt({ kind: 'triage', targetThreshold: 65 });
  const user = buildMatchUserPrompt({
    candidateCard: 'Stack con evidencia:\n- TypeScript',
    offers: [buildOfferCard({
      id: '1',
      title: 'Dev',
      company: 'X',
      description: 'Requisitos: React. Remoto.',
    }, 'triage')],
  });

  assert.match(system, /tech_stack/);
  assert.doesNotMatch(system, /"score": 85/);
  assert.doesNotMatch(system, /decision": "keep"/);
  assert.match(user, /### CANDIDATO/);
  assert.doesNotMatch(user, /80-100 núcleo cubierto/);
  assert.doesNotMatch(user, /CHECKLIST DE REGLAS DURAS/);
});

test('extractOfferSalaryMax reads k-suffix and euro ranges', () => {
  assert.equal(extractOfferSalaryMax('45k-60k €'), 60000);
  assert.equal(extractOfferSalaryMax('Salario: 50.000€ brutos'), 50000);
  assert.equal(extractOfferSalaryMax('Equipo joven y dinámico'), null);
});
