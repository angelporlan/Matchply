import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_LAYOUT,
  CV_METRICS,
  FONT_LINE_RATIO,
  contentWidthPt,
  getFontScale,
  getIconType,
  isSkillsSection,
  joinSkillItem,
  layoutForScale,
  sanitizePdfText,
  splitSkillItem,
  wrapContactItems,
} from '@/lib/cv-layout';

test('font line ratios match the embedded Liberation fonts', () => {
  assert.equal(FONT_LINE_RATIO.helvetica, 2355 / 2048);
  assert.equal(FONT_LINE_RATIO.times, 2355 / 2048);
  assert.equal(FONT_LINE_RATIO.courier, 2320 / 2048);
});

test('print scale matches the PDF route and clamps', () => {
  assert.equal(layoutForScale(1).bodySize, BASE_LAYOUT.bodySize);
  assert.equal(layoutForScale(1).lineGap, 1.5);
  assert.equal(getFontScale(12.5), 1);
  assert.equal(layoutForScale(3).nameSize, BASE_LAYOUT.nameSize * 1.8);
  assert.equal(layoutForScale(0.1).bodySize, BASE_LAYOUT.bodySize * 0.75);
  assert.equal(CV_METRICS.headerRuleGap, 12);
  assert.equal(contentWidthPt(30), 595.28 - 60);
});

test('contact icons follow the PDF label order', () => {
  assert.equal(getIconType('LinkedIn', 'linkedin.com/in/angelporlan'), 'linkedIn');
  assert.equal(getIconType('GitHub', 'github.com/angelporlan'), 'github');
  assert.equal(getIconType('Portfolio', 'example.com'), 'web');
  assert.equal(getIconType('Teléfono', '+34 652 68 49 26'), 'phone');
  assert.equal(getIconType('Email', 'angelporlandev@gmail.com'), 'email');
  assert.equal(getIconType('Ubicación', 'Murcia, España'), 'location');
  assert.equal(getIconType('Nota', 'sin icono'), null);
});

test('skills sections and labels match the PDF', () => {
  assert.equal(isSkillsSection('Habilidades Técnicas'), true);
  assert.equal(isSkillsSection('Experiencia Profesional'), false);
  assert.deepEqual(splitSkillItem('**Frontend**: React'), { label: 'Frontend', value: 'React' });
  assert.equal(joinSkillItem('Frontend', 'React'), '**Frontend**: React');
  assert.equal(splitSkillItem('sin etiqueta'), null);
});

test('pdf text sanitation is display-only and reversible to ASCII punctuation', () => {
  assert.equal(sanitizePdfText('Abril 2025 – Presente'), 'Abril 2025 - Presente');
  assert.equal(sanitizePdfText('“Hola” ‘tal’'), '"Hola" \'tal\'');
  assert.equal(sanitizePdfText('soft\u00adhyphen'), 'softhyphen');
});

test('contact wrapping keeps the separator off the end of a line', () => {
  const items = [
    { textWidth: 142.12, iconWidth: 0 },
    { textWidth: 113.92, iconWidth: 0 },
    { textWidth: 111.75, iconWidth: 0 },
    { textWidth: 150.52, iconWidth: 0 },
    { textWidth: 130.19, iconWidth: 0 },
  ];
  assert.deepEqual(wrapContactItems(items, 17, 535.28), [[0, 1, 2], [3, 4]]);
  assert.deepEqual(
    wrapContactItems([{ textWidth: 10, iconWidth: 0 }, { textWidth: 10, iconWidth: 0 }], 5, 25),
    [[0, 1]],
  );
  assert.deepEqual(
    wrapContactItems([{ textWidth: 10, iconWidth: 0 }, { textWidth: 10, iconWidth: 0 }], 5, 24),
    [[0], [1]],
  );
});
