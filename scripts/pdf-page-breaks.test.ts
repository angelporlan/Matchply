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
School Token | DATE-TOKEN

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
    const date = lines.find((line) => line.text.includes('DATE-TOKEN'));
    assert.ok(heading);
    assert.ok(date);
    assert.equal(date.page, heading.page);
    assert.ok(Math.abs(date.y - heading.y) < 1);
  } finally {
    PDFDocument.prototype._line = original;
  }
});
