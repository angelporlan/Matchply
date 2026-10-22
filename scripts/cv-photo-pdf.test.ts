import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { generatePdfBuffer } from '@/lib/pdf-engine';
import { countPdfPages } from '@/lib/pdf-pages';
import { CV_PHOTO } from '@/lib/cv-layout';

const photo = { bytes: readFileSync('scripts/fixtures/person-avatar.jpg').toString('base64'), hash: 'fixture' };
const markdown = '# Juan Gutierrez\n\n**Email:** juan@example.test | **Teléfono:** +34 600 000 000\n\n## Experiencia\n\n### Consultor de negocios\nEmpresa de ejemplo | 2022 - Presente\n\n- Coordinación de proyectos y equipos.';
test('a photo is embedded only when explicitly supplied and the document remains extractable', async () => {
  const plain = await generatePdfBuffer(markdown);
  const withPhoto = await generatePdfBuffer(markdown, { photo });
  assert.equal((plain.buffer.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length, 0);
  assert.equal((withPhoto.buffer.toString('latin1').match(/\/Subtype \/Image/g) ?? []).length, 1);
  assert.equal(countPdfPages(plain.buffer), 1); assert.equal(countPdfPages(withPhoto.buffer), 1);
});
test('long photo headers wrap within the text column and move the body below the portrait', async () => {
  const lines: Array<{ x: number; y: number; width: number; text: string }> = [];
  const original = PDFDocument.prototype._line;
  PDFDocument.prototype._line = function (this: PDFKit.PDFDocument, text: string, options: any, wrapper: any) {
    lines.push({ x: this.x, y: this.y, width: options.width, text });
    return original.call(this, text, options, wrapper);
  };
  try {
    const long = markdown.replace('Juan Gutierrez', 'Maria del Carmen Fernandez Gutierrez de los Santos').replace('juan@example.test', `${'nombre-largo.'.repeat(8)}@example.test`);
    await generatePdfBuffer(long, { photo, fontSize: 15, pageMargin: 72 });
    const header = lines.filter(line => line.y < 200);
    assert.ok(header.length > 5);
    assert.ok(header.every(line => line.x >= 72 + CV_PHOTO.width + CV_PHOTO.gap));
    const section = lines.find(line => line.text === 'EXPERIENCIA');
    assert.ok(section && section.y > 72 + CV_PHOTO.height);
  } finally { PDFDocument.prototype._line = original; }
});
test('portrait layout preserves pagination bookkeeping in all three font families', async () => {
  const long = markdown + '\n' + '- Coordinación de proyectos y equipos con seguimiento de resultados y planificación de entregas.\n'.repeat(90);
  for (const fontFamily of ['helvetica', 'times', 'courier']) {
    const rendered = await generatePdfBuffer(long, { photo, fontFamily });
    assert.ok(rendered.pageBreaks.length > 0);
    assert.equal(countPdfPages(rendered.buffer), rendered.pageBreaks.length + 1);
  }
});

test('long photo CVs never create a page containing only a bullet mark', async () => {
  const pages = new Map<object, string[]>();
  const original = PDFDocument.prototype._line;
  PDFDocument.prototype._line = function (this: PDFKit.PDFDocument, text: string, options: any, wrapper: any) {
    const page = this.page;
    pages.set(page, [...pages.get(page) ?? [], text]);
    return original.call(this, text, options, wrapper);
  };
  try {
    await generatePdfBuffer(markdown + '\n' + '- Coordinación de equipos, planificación y seguimiento de resultados.\n'.repeat(150), { photo });
    assert.ok(pages.size > 1);
    assert.ok([...pages.values()].every(lines => lines.some(line => line.replace(/\u2022/g, '').trim().length > 0)));
  } finally { PDFDocument.prototype._line = original; }
});
