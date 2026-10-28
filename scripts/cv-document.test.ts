import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CV_MARKDOWN } from '@/lib/default-cv';
import {
  htmlToInlineMarkdown,
  inlineMarkdownToHtml,
  parseCvDocument,
  serializeCvDocument,
} from '@/lib/cv-document';

const messy = `# Ada Lovelace

**Email:** ada@example.com | **Teléfono:** +34 600 000 000

## Perfil
Primera línea
segunda línea del mismo párrafo.

## Experiencia
### Investigadora
**Analytical Engines** | *1843 – 1852*
- Publicó notas con **énfasis**.

## Habilidades
- **Frontend:** React
`;

function assertStable(markdown: string) {
  const parsed = parseCvDocument(markdown);
  const again = parseCvDocument(serializeCvDocument(parsed));
  assert.deepEqual(again, parsed);
}

test('parsing a serialized document does not change the structure', () => {
  assertStable(DEFAULT_CV_MARKDOWN);
  assertStable(messy);
  assertStable('#\n\n## Educación\n### Grado\n**Universidad** | *2015 - 2019*\n');
});

test('the sheet parser keeps dashes and does not invent a name', () => {
  const parsed = parseCvDocument(messy);
  assert.equal(parsed.name, 'Ada Lovelace');
  assert.equal(parsed.sections[1]?.entries[0]?.date, '1843 – 1852');
  assert.equal(parsed.sections[0]?.paragraphs[0], 'Primera línea segunda línea del mismo párrafo.');
  assert.equal(parsed.sections[2]?.bullets[0], '**Frontend**: React');
  assert.equal(parseCvDocument('').name, '');
  assert.equal(parseCvDocument('# \n').name, '');
  const loose = parseCvDocument('# Ana\n\nBackend');
  assert.equal(loose.name, 'Ana');
  assert.equal(loose.sections[0]?.paragraphs[0], 'Backend');
});

test('inline bold and italic survive the editable field', () => {
  const source = 'Reduje el coste un **24%** y el tiempo un *40%*.';
  assert.equal(htmlToInlineMarkdown(inlineMarkdownToHtml(source)), source);
});

test('education entries keep degree, institution, dates and details in their own fields', () => {
  const markdown = `# Candidate

## Formación

### Bootcamp Full-Stack con IA
**Neoland** | *2026*
- HTML, CSS, JavaScript y desarrollo de APIs.

### Técnico Superior en Instalaciones Electrotécnicas
**IES Font de Sant Lluís** | *2004 - 2006*
Detalle: Instalaciones de media y baja tensión.
`;

  const section = parseCvDocument(markdown).sections[0];
  assert.equal(section?.entries.length, 2);
  assert.deepEqual(section?.entries.map(({ heading, subheading, date }) => ({ heading, subheading, date })), [
    { heading: 'Bootcamp Full-Stack con IA', subheading: 'Neoland', date: '2026' },
    { heading: 'Técnico Superior en Instalaciones Electrotécnicas', subheading: 'IES Font de Sant Lluís', date: '2004 - 2006' },
  ]);
  assert.deepEqual(section?.entries[0].bullets, ['HTML, CSS, JavaScript y desarrollo de APIs.']);
  assert.deepEqual(section?.entries[1].paragraphs, ['Detalle: Instalaciones de media y baja tensión.']);
  assert.equal(serializeCvDocument(parseCvDocument(markdown)).includes('**IES Font de Sant Lluís** | *2004 - 2006*'), true);
});

test('plain entry details and non-date metadata stay out of the date column', () => {
  const markdown = `# Candidate

## Formación

### Employment Workshop
Programa de empleabilidad y carrera profesional.

### Curso de APIs
**Centro Formativo** | *2021 - 2022, prácticas*

### Taller de idiomas
**Centro Cívico** | Valencia, España
`;

  const entries = parseCvDocument(markdown).sections[0]?.entries;
  assert.equal(entries?.[0].heading, 'Employment Workshop');
  assert.equal(entries?.[0].date, '');
  assert.deepEqual(entries?.[0].paragraphs, ['Programa de empleabilidad y carrera profesional.']);
  assert.equal(entries?.[1].subheading, 'Centro Formativo');
  assert.equal(entries?.[1].date, '2021 - 2022');
  assert.deepEqual(entries?.[1].paragraphs, ['prácticas']);
  assert.equal(entries?.[2].subheading, 'Centro Cívico');
  assert.equal(entries?.[2].date, '');
  assert.deepEqual(entries?.[2].paragraphs, ['Valencia, España']);
});
