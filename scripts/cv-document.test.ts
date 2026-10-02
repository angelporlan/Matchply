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
