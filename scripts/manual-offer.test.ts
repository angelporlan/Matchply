import test from 'node:test';
import assert from 'node:assert/strict';
import { manualOffer } from '@/lib/offer-import/manual';

const description = 'Buscamos una desarrolladora Python para crear APIs con pruebas automatizadas. Trabajo en equipo y experiencia con bases de datos.';

test('a pasted offer is usable without a URL and preserves the full description', () => {
  const offer = manualOffer(`  ${description}  `);
  assert.ok(offer);
  assert.equal(offer.url, '');
  assert.equal(offer.platform, 'other');
  assert.equal(offer.jobDescription, description);
  assert.equal(offer.sourceMethod, 'manual');
});

test('an optional malformed or unsupported URL cannot break a pasted description', () => {
  for (const url of ['not a URL', 'https://linkedin.com/jobs', 'javascript:alert(1)']) {
    const offer = manualOffer(description, url);
    assert.ok(offer); assert.equal(offer.url, ''); assert.equal(offer.jobDescription, description);
  }
});

test('a valid optional URL retains canonical platform and identity', () => {
  const offer = manualOffer(description, 'https://linkedin.com/jobs/view/123456/?trackingId=x');
  assert.ok(offer);
  assert.equal(offer.url, 'https://www.linkedin.com/jobs/view/123456/');
  assert.equal(offer.platform, 'linkedin');
});

test('too short and oversized pasted descriptions do not enable adaptation', () => {
  for (const value of ['', 'Python', 'a'.repeat(120_001)]) assert.equal(manualOffer(value), null);
});
