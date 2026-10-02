import test from 'node:test';
import assert from 'node:assert/strict';
import { NEUTRAL_COMPANY, NEUTRAL_JOB_TITLE, resolveOfferIdentity } from '@/lib/offer-fields';
import es from '@/lib/i18n/es';
import en from '@/lib/i18n/en';

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

test('adapt modals mark only the job description as required', () => {
  for (const labels of [
    es.dashboard.modal.ai,
    es.editor.aiModal,
    en.dashboard.modal.ai,
    en.editor.aiModal,
  ]) {
    assert.equal(labels.jobTitle.includes('*'), false);
    assert.equal(labels.company.includes('*'), false);
    assert.equal(labels.descLabel.includes('*'), true);
  }
  assert.equal(es.applications.modal.jobField.includes('*'), true);
  assert.equal(es.applications.modal.companyField.includes('*'), true);
});

test('a linkedin header paste keeps the role and the company, not the logo line', () => {
  const resolved = resolveOfferIdentity({
    jobDescription: [
      'Logotipo de NTT DATA Europe & Latam',
      'NTT DATA Europe & Latam',
      'Compartir',
      'Mostrar más opciones',
      'AI Full Stack Engineer – GenAI & Agentic AI',
      'Madrid, Comunidad de Madrid, España · hace 1 hora · 4 solicitudes',
      'Promocionado por técnico de selección · Aún no hay información disponible sobre respuestas',
      'Híbrido',
      'Jornada completa',
      'Solicitud sencilla',
      'Guardar',
      'Guardar «AI Full Stack Engineer – GenAI & Agentic AI » en NTT DATA Europe & Latam',
      'AI Full Stack Engineer – GenAI & Agentic AI',
      'NTT DATA Europe & Latam · Madrid, Comunidad de Madrid, España (Híbrido)',
    ].join('\n'),
  });
  assert.equal(resolved.jobTitle, 'AI Full Stack Engineer – GenAI & Agentic AI');
  assert.equal(resolved.company, 'NTT DATA Europe & Latam');
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
