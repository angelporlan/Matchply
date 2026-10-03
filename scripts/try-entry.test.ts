import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCvDocument } from '@/lib/cv-document';
import { coldRegisterDestination, resolveTryGate, trialCvMarkdown } from '@/lib/try-entry';

test('a visitor without a session is sent to create a guest and return to /try', () => {
  assert.deepEqual(
    resolveTryGate({ hasViewer: false, cvCount: 0, offerCount: 0 }),
    { kind: 'redirect', href: '/api/guest?redirect=/try' },
  );
});

test('a guest or account that already has a CV or candidacy goes to the dashboard', () => {
  assert.deepEqual(
    resolveTryGate({ hasViewer: true, cvCount: 1, offerCount: 0 }),
    { kind: 'redirect', href: '/dashboard' },
  );
  assert.deepEqual(
    resolveTryGate({ hasViewer: true, cvCount: 0, offerCount: 2 }),
    { kind: 'redirect', href: '/dashboard' },
  );
});

test('an empty guest or a new account stays on the adapt screen', () => {
  assert.deepEqual(
    resolveTryGate({ hasViewer: true, cvCount: 0, offerCount: 0 }),
    { kind: 'entry' },
  );
});

test('a cold register with no guest draft opens /try', () => {
  assert.equal(coldRegisterDestination({ hasSession: false, hasGuestCookie: false }), '/try');
  assert.equal(coldRegisterDestination({ hasSession: false, hasGuestCookie: true }), null);
  assert.equal(coldRegisterDestination({ hasSession: true, hasGuestCookie: false }), null);
});

test('plain pasted text becomes a visible resume and an existing heading is kept', () => {
  const plain = trialCvMarkdown('  Ana Ruiz\nBackend  ', 'Resume');
  assert.match(plain, /^# Ana Ruiz\n/);
  assert.match(plain, /## Resume\n\nBackend/);
  assert.equal(parseCvDocument(plain).name, 'Ana Ruiz');
  assert.equal(parseCvDocument(plain).sections[0]?.paragraphs[0], 'Backend');

  assert.equal(trialCvMarkdown('# Ana\n\nBackend'), '# Ana\n\nBackend');
  assert.equal(trialCvMarkdown('   '), '');
});

test('a PDF extract becomes the base resume the template can draw', () => {
  const markdown = trialCvMarkdown(`ANA RUIZ
Email: ana@example.com · Teléfono: +34 600 000 000
PERFIL PROFESIONAL
Ingeniera backend con experiencia en APIs.
Trabaja con Node.js.
EXPERIENCIA PROFESIONAL
Desarrolladora
2020 - 2024
Ejemplo SL
•Hice APIs
de pagos.
HABILIDADES TÉCNICAS
Backend: Node.js, PostgreSQL
`);
  const cv = parseCvDocument(markdown);
  assert.equal(cv.name, 'ANA RUIZ');
  assert.equal(cv.contact[0]?.label, 'Email');
  assert.equal(cv.contact[1]?.value, '+34 600 000 000');
  assert.deepEqual(cv.sections.map((section) => section.title), [
    'Perfil profesional',
    'Experiencia profesional',
    'Habilidades técnicas',
  ]);
  assert.match(cv.sections[0].paragraphs[0], /Ingeniera backend/);
  assert.match(cv.sections[0].paragraphs[0], /Node\.js/);
  assert.equal(cv.sections[1].entries[0]?.heading, 'Desarrolladora');
  assert.equal(cv.sections[1].entries[0]?.subheading, 'Ejemplo SL');
  assert.equal(cv.sections[1].entries[0]?.date, '2020 - 2024');
  assert.equal(cv.sections[1].entries[0]?.bullets[0], 'Hice APIs de pagos.');
  assert.match(cv.sections[2].bullets[0], /Node\.js, PostgreSQL/);
});
