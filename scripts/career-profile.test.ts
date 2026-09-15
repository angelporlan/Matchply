import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addUniqueSkill,
  attachSkillEvidence,
  computeProfileCompleteness,
  detectStructuredProfile,
  entriesOfKind,
  extractProjectsFromMarkdown,
  extractSkillsFromText,
  formatCareerProfileContext,
  hydrateStructuredProfile,
  mergeSkills,
  normalizeCareerProfileFields,
  skillsFromTechStack,
  techStackFromSkills,
} from '@/lib/career-profile';

const BIO = 'Programador Full Stack con 2 años de experiencia profesional y un SaaS propio en producción. Especializado en PHP (Laravel), Node.js, TypeScript, APIs RESTful y desarrollo frontend con Angular y React. Experiencia demostrada en la optimización de bases de datos relacionales (MySQL/PostgreSQL) y entornos contenedorizados con Docker.';

const CV = `# CARLOS GARCÍA LÓPEZ

## Perfil Profesional
${BIO}

## Experiencia Profesional
### Desarrollador Full Stack (PHP Laravel & Node.js)
**Acme Technologies** | *Abril 2025 – Presente*
* Desarrollé servicios backend y APIs RESTful robustas en PHP (Laravel) y Node.js bajo arquitectura limpia.
* Incorporé APIs de LLMs en flujos de backend para automatizar la clasificación de documentación académica, ahorrando 15 horas semanales.

### Desarrollador Full Stack
**CloudSystems Labs** | *Febrero 2024 – Junio 2024*
* Optimicé esquemas relacionales y consultas SQL en MySQL/PostgreSQL, reduciendo tiempos de respuesta de APIs en un 50%.
* Configuré entornos contenedorizados usando Docker y Docker Compose.

## Proyectos Propios
### Matchply
**Matchply** | *2025 – Presente*
Fundé y desarrollé en solitario Matchply, una plataforma SaaS de optimización de CVs integrada con modelos de IA.
* Implementé pasarela de pagos Stripe configurando suscripciones recurrentes.
* Diseñé una arquitectura Full Stack desplegada en VPS propio con Docker y pipelines de CI/CD.

## Educación
### Técnico Superior en DAW
**Instituto Tecnológico Central** | *2022 – 2024*
* Mención de honor.
`;

test('profile normalization preserves explicit scoring rules across unrelated profile edits', () => {
  const saved = normalizeCareerProfileFields({
    bio: 'Trayectoria inicial', englishLevel: 'b2', curationCriteria: 'Prioriza equipos de producto.',
    scoringPreferences: { version: 1, reviewRequired: [], languageRules: [{
      id: 'german-required', language: 'de', condition: 'required', action: 'reject', source: 'explicit',
    }] },
  });
  const updated = normalizeCareerProfileFields({ ...saved, bio: 'Trayectoria actualizada', englishLevel: 'c1' });
  assert.deepEqual(updated.scoringPreferences, saved.scoringPreferences);
  assert.equal(updated.englishLevel, 'c1');
});

test('profile normalization never turns its factual English level into a preference', () => {
  const profile = normalizeCareerProfileFields({ englishLevel: 'b2', englishOverLevelPolicy: 'penalize' });
  assert.deepEqual(profile.scoringPreferences.languageRules, []);
  assert.equal(profile.englishLevel, 'b2');
  assert.ok(profile.scoringPreferences.reviewRequired.length > 0);
});

test('extracts real stack from a fullstack dump and does not invent Java', () => {
  const skills = extractSkillsFromText(BIO);
  const names = skills.map((skill) => skill.name);
  assert.ok(names.includes('PHP'));
  assert.ok(names.includes('Laravel'));
  assert.ok(names.includes('Node.js'));
  assert.ok(names.includes('TypeScript'));
  assert.ok(names.includes('Angular'));
  assert.ok(names.includes('React'));
  assert.ok(names.includes('Docker'));
  assert.equal(names.includes('Java'), false);
  assert.equal(names.includes('Camunda'), false);
});

test('extracts jobs and own projects from a markdown CV', () => {
  const projects = extractProjectsFromMarkdown(CV);
  const jobs = entriesOfKind(projects, 'experience');
  const personal = entriesOfKind(projects, 'project');
  assert.ok(jobs.some((item) => /Acme/i.test(item.title)));
  assert.ok(jobs.some((item) => /CloudSystems/i.test(item.title)));
  assert.ok(personal.some((item) => /Matchply/i.test(item.title)));
  assert.equal(jobs.some((item) => /Matchply/i.test(item.title)), false);
  assert.equal(personal.some((item) => /Acme/i.test(item.title)), false);
  assert.equal(projects.some((item) => /DAW|Instituto Tecnológico/i.test(item.title)), false);
  const acme = jobs.find((item) => /Acme/i.test(item.title));
  assert.match(acme?.role || '', /Full Stack/i);
  const matchply = personal.find((item) => /Matchply/i.test(item.title));
  assert.ok(matchply?.description);
});

test('detectStructuredProfile hydrates skills with project evidence', () => {
  const detected = detectStructuredProfile({ bio: BIO, cvMarkdown: CV });
  assert.ok(detected.skills.length >= 5);
  assert.ok(detected.projects.length >= 2);
  const node = detected.skills.find((skill) => skill.name === 'Node.js');
  assert.ok(node?.evidence);
  assert.notEqual(node?.evidence, 'Trayectoria');
});

test('completeness rewards evidence not just dump length', () => {
  const empty = computeProfileCompleteness({ bio: BIO });
  assert.ok(empty.score < 50);
  assert.ok(empty.missingItems.some((item) => item.section === 'skills'));

  const detected = detectStructuredProfile({ bio: BIO, cvMarkdown: CV });
  const ready = computeProfileCompleteness({
    bio: BIO,
    masterDocument: `${BIO}\n\nProducto propio Matchply en producción con Stripe y Docker.`,
    curationCriteria: 'Prioriza TypeScript y Node. Penaliza ofertas en inglés.',
    skills: detected.skills,
    keyProjects: detected.projects,
    preferredLocations: 'Remoto, Valencia',
    preferredWorkplaces: ['remote'],
    salaryMin: 35000,
  });
  assert.ok(ready.score >= 80, `expected >= 80, got ${ready.score}`);
  assert.equal(ready.level, 'Listo para la IA');
});

test('formatCareerProfileContext keeps stack even when a master document exists', () => {
  const detected = detectStructuredProfile({ bio: BIO, cvMarkdown: CV });
  const context = formatCareerProfileContext({
    bio: BIO,
    masterDocument: 'Documento maestro de prueba sobre un fullstack con SaaS propio.',
    skills: detected.skills,
    keyProjects: detected.projects,
    preferredLocations: 'Remoto',
    curationCriteria: 'Penaliza inglés',
  });
  assert.match(context, /Stack con evidencia/);
  assert.match(context, /TypeScript/);
  assert.match(context, /Experiencia profesional/);
  assert.match(context, /Proyectos personales/);
  assert.match(context, /Matchply/);
  assert.match(context, /Acme/);
  assert.match(context, /Criterios de puntuación/);
});

test('hydrateStructuredProfile derives techStack from detected skills', () => {
  const hydrated = hydrateStructuredProfile({
    techStack: { backend: ['Laravel'], frontend: ['React'] },
  }, { bio: BIO, cvMarkdown: CV });
  assert.ok(hydrated.techStack.backend?.includes('Laravel'));
  assert.ok(hydrated.skills.some((skill) => skill.name === 'Docker'));
});

test('skillsFromTechStack and reverse conversion stay aligned', () => {
  const skills = skillsFromTechStack({ frontend: ['React'], backend: ['Node.js'] });
  const stack = techStackFromSkills(skills);
  assert.deepEqual(stack.frontend, ['React']);
  assert.deepEqual(stack.backend, ['Node.js']);
});

test('mergeSkills keeps user evidence and upgrades proficiency', () => {
  const merged = mergeSkills(
    [{ name: 'Docker', category: 'cloud_devops', proficiency: 'used', evidence: 'CloudSystems Labs' }],
    [{ name: 'Docker', category: 'cloud_devops', proficiency: 'core' }, { name: 'Stripe', category: 'backend', proficiency: 'solid' }],
  );
  const docker = merged.find((skill) => skill.name === 'Docker');
  assert.equal(docker?.proficiency, 'core');
  assert.equal(docker?.evidence, 'CloudSystems Labs');
  assert.ok(merged.some((skill) => skill.name === 'Stripe'));
});

test('saving a profile does not resurrect skills the user removed', () => {
  const saved = normalizeCareerProfileFields({
    bio: BIO,
    skills: [{ name: 'TypeScript', category: 'frontend', proficiency: 'core', evidence: 'Matchply' }],
    keyProjects: [{ title: 'Matchply', description: 'SaaS con Stripe y Docker', impact: 'Usuarios de pago' }],
  });
  const names = saved.skills.map((skill: { name: string }) => skill.name);
  assert.deepEqual(names, ['TypeScript']);
  assert.equal(saved.techStack.frontend?.[0], 'TypeScript');
});

test('addUniqueSkill appends a suggestion even when the list is already long', () => {
  const current = Array.from({ length: 24 }, (_, index) => ({
    name: `Skill${index}`,
    category: 'other' as const,
    proficiency: 'used' as const,
  }));
  const merged = mergeSkills(current, [{ name: 'Express', category: 'backend', proficiency: 'solid' }]);
  assert.ok(merged.some((skill) => skill.name === 'Express'));
  const added = addUniqueSkill(current, { name: 'REST APIs', category: 'backend', proficiency: 'solid' });
  assert.ok(added.some((skill) => skill.name === 'REST APIs'));
  assert.equal(added.length, 25);
});

test('attachSkillEvidence falls back to a matching project title', () => {
  const [skill] = attachSkillEvidence(
    [{ name: 'Stripe', category: 'backend', proficiency: 'solid' }],
    [{ title: 'Matchply', description: 'Pagos con Stripe', impact: 'Usuarios de pago' }],
  );
  assert.equal(skill.evidence, 'Matchply');
});
