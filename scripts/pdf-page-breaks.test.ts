import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import { generatePdfBuffer } from '@/lib/pdf-engine';
import { countPdfPages } from '@/lib/pdf-pages';
import { planPagePushes } from '@/lib/pdf-page-breaks';

test('page pushes land each broken line at the top of the next sheet', () => {
  const pagePx = 100;
  const gapPx = 10;
  const pt = (px: number) => px * 72 / 96;
  const plan = planPagePushes([10, 40, 90, 130], [pt(88)], pagePx, gapPx);
  assert.deepEqual(plan, [{ lineIndex: 2, pushPx: 20 }]);

  const next = planPagePushes([10, 90, 150], [pt(88), pt(140)], pagePx, gapPx);
  assert.deepEqual(next, [
    { lineIndex: 1, pushPx: 20 },
    { lineIndex: 2, pushPx: 50 },
  ]);
});

test('an entry date stays on the heading page when the heading starts a new PDF page', async () => {
  const bullet = 'Diseñé servicios backend y APIs REST con pruebas, observabilidad, colas de trabajo y despliegue en contenedores reproducibles para varios entornos.';
  const bullets = Array.from({ length: 70 }, () => `- ${bullet}`).join('\n');
  const markdown = `# Test User

**Email:** a@b.co | **Teléfono:** +34 600 000 000

## Experiencia

### Role One
Company | 2020 - 2021

${bullets}

## Educación

### HEADING-TOKEN
School Token | 2018 - 2020

- Honor mention
`;

  const lines: { page: number; y: number; text: string }[] = [];
  const original = PDFDocument.prototype._line;
  (PDFDocument.prototype as unknown as { _line: (text: string, options: unknown, wrapper: unknown) => unknown })._line = function (
    this: PDFKit.PDFDocument,
    text: string,
    options: unknown,
    wrapper: unknown,
  ) {
    const range = this.bufferedPageRange();
    lines.push({
      page: range.start + range.count,
      y: this.y,
      text: String(text),
    });
    return original.call(this, text, options, wrapper);
  };

  try {
    const { buffer, pageBreaks } = await generatePdfBuffer(markdown, {
      fontFamily: 'helvetica',
      pageMargin: 36,
      fontSize: 12.5,
      showIcons: false,
    });
    assert.equal(countPdfPages(buffer), pageBreaks.length + 1);
    assert.ok(pageBreaks.length >= 1);
    assert.ok(pageBreaks.every((value, index) => value > 0 && (index === 0 || value > pageBreaks[index - 1])));

    const heading = lines.find((line) => line.text.includes('HEADING-TOKEN'));
    const date = lines.find((line) => line.text.includes('2018 - 2020'));
    assert.ok(heading);
    assert.ok(date);
    assert.equal(date.page, heading.page);
    assert.ok(Math.abs(date.y - heading.y) < 1);
  } finally {
    PDFDocument.prototype._line = original;
  }
});

test('an entry date stays in its own column when both header fields are long', async () => {
  const headingText = 'TITLE-TOKEN Técnico superior en instalaciones electrotécnicas industriales';
  const dateText = '2020 - 2024 (DATE-TOKEN), prácticas y formación complementaria';
  const markdown = `# Synthetic Candidate\n\n## Educación\n\n### ${headingText}\nSchool | ${dateText}\n`;
  const fields: { text: string; x: number; width: number }[] = [];
  const prototype = PDFDocument.prototype as unknown as {
    text: (this: PDFKit.PDFDocument, text: string | Buffer, x?: number, y?: number, options?: { width?: number }) => unknown;
  };
  const original = prototype.text;
  prototype.text = function (this: PDFKit.PDFDocument, text, x, y, options) {
    const value = String(text);
    if (value.includes('TITLE-TOKEN') || value.includes('2020 - 2024')) {
      fields.push({ text: value, x: Number(x), width: Number(options?.width) });
    }
    return original.call(this, text, x, y, options);
  };

  try {
    await generatePdfBuffer(markdown, { fontFamily: 'helvetica', pageMargin: 36, fontSize: 12.5, showIcons: false });
    const heading = fields.find((field) => field.text.includes('TITLE-TOKEN'));
    const date = fields.find((field) => field.text.includes('2020 - 2024'));
    assert.ok(heading);
    assert.ok(date);
    assert.ok(heading.x + heading.width < date.x, 'title and date columns must not overlap');
  } finally {
    prototype.text = original;
  }
});

test('a section heading stays with its first entry when the page is nearly full', async () => {
  const filler = Array.from({ length: 51 }, (_, index) => `- Synthetic bullet ${index + 1}`).join('\n');
  const markdown = `# Synthetic Candidate

**Email:** candidate@example.test | **Phone:** +34 600 000 000

## Experience

${filler}

## EDUCATION-TOKEN

### HEADING-TOKEN
**SCHOOL-TOKEN** | *2015 - 2019*
`;
  const lines: { page: number; text: string }[] = [];
  const original = PDFDocument.prototype._line;
  (PDFDocument.prototype as unknown as { _line: (text: string, options: unknown, wrapper: unknown) => unknown })._line = function (
    this: PDFKit.PDFDocument,
    text: unknown,
    options: unknown,
    wrapper: unknown,
  ) {
    const range = this.bufferedPageRange();
    lines.push({ page: range.start + range.count, text: String(text) });
    return original.call(this, text, options, wrapper);
  };

  try {
    await generatePdfBuffer(markdown, {
      fontFamily: 'helvetica',
      pageMargin: 36,
      fontSize: 12.5,
      showIcons: false,
    });
    const pageOf = (token: string) => lines.find((line) => line.text.includes(token))?.page;
    assert.ok(pageOf('EDUCATION-TOKEN'));
    assert.ok(pageOf('HEADING-TOKEN'));
    assert.ok(pageOf('SCHOOL-TOKEN'));
    assert.equal(pageOf('EDUCATION-TOKEN'), pageOf('HEADING-TOKEN'));
    assert.equal(pageOf('HEADING-TOKEN'), pageOf('SCHOOL-TOKEN'));
    assert.equal(pageOf('HEADING-TOKEN'), pageOf('2015 - 2019'));
  } finally {
    PDFDocument.prototype._line = original;
  }
});
