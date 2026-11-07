import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCvLibrary } from '@/lib/cv-library';
import type { CvListItem, CvTargetSummary } from '@/lib/job-offer-queries';
const cvs: CvListItem[] = [
  { id: 'base', title: 'Currículum principal', isBase: true, isPrincipal: true, templateName: 'harvard', accentColor: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'one', title: 'Versión técnica', isBase: false, isPrincipal: false, templateName: 'harvard', accentColor: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'two', title: 'Versión producto', isBase: false, isPrincipal: false, templateName: 'harvard', accentColor: null, createdAt: new Date(), updatedAt: new Date() },
];
const targets = new Map<string, CvTargetSummary>([['one', { cvId: 'one', company: 'Acme', title: 'Ingeniería', scoreOverall: null }], ['two', { cvId: 'two', company: 'Beta', title: 'Producto', scoreOverall: null }]]);
const defaults = { search: '', type: 'all' as const, company: '', role: '' };
test('CV library combines type, company, role and accent-insensitive search', () => {
  assert.deepEqual(filterCvLibrary(cvs, targets, { ...defaults, type: 'optimized', company: 'Acme', role: 'Ingeniería', search: 'tecnica' }).map(cv => cv.id), ['one']);
  assert.deepEqual(filterCvLibrary(cvs, targets, { ...defaults, company: 'Acme', role: 'Producto' }), []);
  assert.deepEqual(filterCvLibrary(cvs, targets, { ...defaults, type: 'base' }).map(cv => cv.id), ['base']);
});
test('CV library searches linked roles/companies and keeps unlinked CVs when filters clear', () => {
  assert.deepEqual(filterCvLibrary(cvs, targets, { ...defaults, search: 'ingenieria' }).map(cv => cv.id), ['one']);
  assert.deepEqual(filterCvLibrary(cvs, targets, { ...defaults, search: ' BETA ' }).map(cv => cv.id), ['two']);
  assert.deepEqual(filterCvLibrary(cvs, targets, defaults), cvs);
  assert.equal(cvs.length, 3);
});
