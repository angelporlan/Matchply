import test from 'node:test';
import assert from 'node:assert/strict';
import { NEUTRAL_COMPANY, NEUTRAL_JOB_TITLE, resolveOfferIdentity } from '@/lib/offer-fields';

test('a description alone fills neutral title and company when nothing can be inferred', () => {
  const resolved = resolveOfferIdentity({
    jobTitle: '',
    company: '  ',
    jobDescription: 'Buscamos a alguien que lleve el cierre contable mensual y la conciliación bancaria del equipo.',
  });
  assert.equal(resolved.jobTitle, NEUTRAL_JOB_TITLE);
  assert.equal(resolved.company, NEUTRAL_COMPANY);
});

test('labeled lines in the description become the title and company', () => {
  const resolved = resolveOfferIdentity({
    jobDescription: 'Puesto: Analista de datos\nEmpresa: Norte Retail\nRequisitos: SQL y Python.',
  });
  assert.equal(resolved.jobTitle, 'Analista de datos');
  assert.equal(resolved.company, 'Norte Retail');
});

test('an explicit title is kept and a missing company stays neutral', () => {
  const resolved = resolveOfferIdentity({
    jobTitle: 'Controller',
    company: '',
    jobDescription: 'Cierre mensual, reporting y relación con auditoría externa.',
  });
  assert.equal(resolved.jobTitle, 'Controller');
  assert.equal(resolved.company, NEUTRAL_COMPANY);
});
