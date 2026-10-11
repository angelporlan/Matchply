import test from 'node:test';
import assert from 'node:assert/strict';
import { factualProfile, parseAnalysisResponse, validateAnalysis, validateVariant } from '@/lib/cv-optimization/validation';
import { CV_GENERATION_BASE, CV_MODE_BLOCKS, generationPrompts } from '@/lib/cv-optimization/prompts';
import { OPTIMIZE_MODE_IDS } from '@/lib/optimize-modes';

export const cvFixture = '# Ana Pérez\n\n**Email:** ana@example.test | **Teléfono:** +34 600 123 456\n\n## Perfil Profesional\nDesarrolladora de APIs con Python.\n\n## Experiencia Profesional\n### Desarrolladora Backend\n**Acme** | *2022 – Presente*\n- Desarrollé APIs con Python y reduje el tiempo un 20%.\n\n## Habilidades\n- **Backend:** Python, PostgreSQL\n';
export const analysisFixture = { rol_objetivo: 'Backend', idioma_oferta: 'es', top5: ['Python', 'FastAPI'],
  keywords: [{ termino: 'Python', tipo: 'imprescindible', evidencia: 'fuerte', cita_cv: 'Desarrollé APIs con Python', sinonimos_reales: [] },
    { termino: 'FastAPI', tipo: 'imprescindible', evidencia: 'ninguna', cita_cv: null, sinonimos_reales: [] }],
  gaps: [{ requisito: 'FastAPI', gravedad: 'critico', sugerencia: 'Añade un proyecto con FastAPI solo si es real.' }],
  titular_sugerido: 'Desarrolladora Backend', contenido_a_priorizar: ['Desarrollé APIs con Python'], sugerencias_metricas: ['Mide el volumen real de peticiones.'] };

test('analysis invalidates false quotes, filters invented synonyms and preserves hard gaps', () => {
  const a = validateAnalysis({ ...analysisFixture, keywords: [{ ...analysisFixture.keywords[0], cita_cv: 'Inventé React', sinonimos_reales: ['Inventé React'] }, analysisFixture.keywords[1]] }, cvFixture, '');
  assert.equal(a.keywords[0].evidencia, 'ninguna'); assert.equal(a.keywords[0].cita_cv, null);
  assert.deepEqual(a.keywords[0].sinonimos_reales, []); assert.equal(a.gaps.length, 2);
  assert.equal(a.gaps.find(g => g.requisito === 'FastAPI')?.gravedad, 'critico');
  assert.throws(() => validateAnalysis({ ...analysisFixture, gaps: 'invalid' }, cvFixture, ''));
  assert.throws(() => parseAnalysisResponse('Private candidate contact, malformed JSON',cvFixture,''), {message:'INVALID_ANALYSIS'});
});
test('CV validation rejects unsupported tech, invented metrics, historical edits, missing jobs and placeholders', () => {
  const a = validateAnalysis(analysisFixture, cvFixture, '');
  assert.deepEqual(validateVariant(cvFixture, cvFixture, '', a), []);
  assert.ok(validateVariant(cvFixture.replace('20%', '87%'), cvFixture, '', a).some(e => e.startsWith('UNSUPPORTED_NUMBER')));
  assert.ok(validateVariant(cvFixture + '\n- FastAPI, Kubernetes', cvFixture, '', a).some(e => e.startsWith('UNSUPPORTED_TECH')));
  assert.ok(validateVariant(cvFixture.replace('**Acme**', '**Globex**'), cvFixture, '', a).includes('CHANGED_COMPANY'));
  assert.ok(validateVariant(cvFixture.replace('2022', '2015'), cvFixture, '', a).includes('CHANGED_DATES'));
  assert.ok(validateVariant(cvFixture.replace('Desarrolladora Backend', 'Directora'), cvFixture, '', a).includes('MISSING_JOB'));
  assert.ok(validateVariant(cvFixture + '\n[COMPLETAR: métrica]', cvFixture, '', a).includes('PLACEHOLDER_OR_FENCE'));
  assert.ok(validateVariant(cvFixture + '\n[INSERT metric]', cvFixture, '', a).includes('PLACEHOLDER_OR_FENCE'));
  assert.ok(validateVariant(cvFixture + '\nInglés C2', cvFixture + '\nInglés B2', '', a).some(e => e.startsWith('UNSUPPORTED_LEVEL')));
});
test('repeated historical titles retain their own company and dates; aliases are supported', () => {
  const a = validateAnalysis(analysisFixture, cvFixture, '');
  const repeated = cvFixture.replace('## Habilidades', '### Desarrolladora Backend\n**Globex** | *2020 – 2021*\n- Desarrollo servicios.\n\n## Habilidades');
  assert.deepEqual(validateVariant(repeated,repeated,'',a),[]);
  assert.deepEqual(validateVariant(cvFixture.replace('PostgreSQL','Postgres'),cvFixture,'',a),[]);
  assert.deepEqual(validateVariant(cvFixture.replaceAll('Python','JavaScript'),cvFixture.replaceAll('Python','JS'),'',a),[]);
  const education = cvFixture + '\n## Educación\n### Grado\n**Universidad** | *2018 – 2022*\n';
  assert.ok(validateVariant(cvFixture,education,'',a).includes('MISSING_CREDENTIAL'));
});
test('only facts enter profile context; only faithful limits substantive rewriting', () => {
  const profile = factualProfile({ bio: 'Uso Python', targetRoles: ['Director'], classification: { seniority: 'senior' }, salaryTarget: 99999 });
  assert.match(profile, /Uso Python/); assert.doesNotMatch(profile, /Director|senior|99999/);
  assert.doesNotMatch(CV_GENERATION_BASE, /máximo 6/); assert.match(CV_MODE_BLOCKS.optimize_honest, /máximo 6/);
  const analysis = validateAnalysis(analysisFixture, cvFixture, '');
  for (const mode of OPTIMIZE_MODE_IDS) { const p = generationPrompts(mode, cvFixture, profile, 'Python', analysis); assert.ok(p.userPrompt.includes(cvFixture)); assert.match(p.userPrompt, /ANÁLISIS JSON/); }
});
