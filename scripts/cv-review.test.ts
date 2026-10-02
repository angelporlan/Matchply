import test from 'node:test';
import assert from 'node:assert/strict';
import { cvSectionChips, reviewCvMarkdown } from '@/lib/cv-review';

const healthy = `# Ana Pérez

**Email:** ana@example.com | **Teléfono:** +34 612 345 678

## Perfil
Ingeniera de software. Construye productos web y acompaña a equipos pequeños.

## Experiencia
### Ingeniera
**Northwind** | *2019 - 2022*
- Reduje el tiempo de despliegue un 30%.

## Educación
### Grado
**Universidad** | *2015 - 2019*
`;

test('a complete resume reports contact and summary, and does not flag education', () => {
  const issues = reviewCvMarkdown(healthy);
  assert.deepEqual(issues.map((issue) => issue.code), ['contact_ok', 'summary_ok']);
  assert.equal(cvSectionChips(healthy)[0]?.kind, 'contact');
  assert.deepEqual(
    cvSectionChips(healthy).slice(1).map((chip) => chip.title),
    ['Perfil', 'Experiencia', 'Educación'],
  );
});

test('missing contact, a long summary, a project without bullets and a bad date are named', () => {
  const words = Array.from({ length: 50 }, () => 'palabra').join(' ');
  const markdown = `# Sin datos

## Resumen
${words}

## Proyectos
### Gestor
**Estudio** | *pronto*
Descripción sin viñetas.
`;
  const issues = reviewCvMarkdown(markdown);
  assert.ok(issues.some((issue) => issue.code === 'contact_missing_email'));
  assert.ok(issues.some((issue) => issue.code === 'contact_missing_phone'));
  const summary = issues.find((issue) => issue.code === 'summary_long');
  assert.equal(summary?.section, 'Resumen');
  assert.equal(summary?.words, 50);
  assert.ok(issues.some((issue) => issue.code === 'entry_no_bullets' && issue.entry === 'Gestor'));
  assert.ok(issues.some((issue) => issue.code === 'entry_date' && issue.section === 'Proyectos'));
});

test('a single summary section does not invent experience warnings', () => {
  const issues = reviewCvMarkdown(`# Ada

**Email:** ada@example.com
**Phone:** +1 415 555 0134

## Summary
Short profile for tests.
`);
  assert.deepEqual(issues.map((issue) => issue.code), ['contact_ok', 'summary_ok']);
  assert.equal(cvSectionChips(`## Summary\nHola`).length, 2);
});

test('an open-ended date range is accepted', () => {
  const issues = reviewCvMarkdown(`# Ada

**Email:** ada@example.com | **Tel:** 612345678

## Perfil
Texto breve.

## Experience
### Lead
**Acme** | *2022 - actualidad*
- Entregué el rediseño.
`);
  assert.equal(issues.some((issue) => issue.code === 'entry_date'), false);
  assert.equal(issues.some((issue) => issue.code === 'entry_no_bullets'), false);
});
