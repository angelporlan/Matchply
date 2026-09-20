import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizeUserDataPackage } from '@/lib/user-data-import';

function basePackage(overrides: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = {
    format: 'matchply-user-data',
    version: 1,
    source: { sourceId: '88d9fa60-677e-48d0-93be-5c2fdd88a468', email: 'angelporlandev@gmail.com', exportedAt: '2026-09-20T20:00:00.000Z' },
    user: { id: '88d9fa60-677e-48d0-93be-5c2fdd88a468', email: 'angelporlandev@gmail.com', name: 'Ángel Porlán', image: null, careerProfile: null, createdAt: '2026-08-23T11:12:23.700Z' },
    cvs: [],
    companies: [],
    companyIcons: [],
    userCompanies: [],
    companyNotes: [],
    jobOffers: [],
    applicationViews: [],
    jobResearchRuns: [],
    jobResearchAgentRuns: [],
    jobResearchSources: [],
  };
  Object.assign(data, overrides);
  const canonical = JSON.stringify(data);
  data.manifest = {
    payloadSha256: createHash('sha256').update(canonical).digest('hex'),
    counts: {
      cvs: 0, companies: 0, companyIcons: 0, userCompanies: 0, companyNotes: 0,
      jobOffers: 0, applicationViews: 0, jobResearchRuns: 0, jobResearchAgentRuns: 0, jobResearchSources: 0,
    },
  };
  return data;
}

test('normalizes an empty valid package without opening the database', () => {
  const result = normalizeUserDataPackage(basePackage());
  assert.equal(result.sourceEmail, 'angelporlandev@gmail.com');
  assert.equal(result.cvs.length, 0);
});

test('rejects credentials and token fields before import', () => {
  assert.throws(() => normalizeUserDataPackage(basePackage({ user: { passwordHash: 'secret' } })), /campo prohibido/i);
});

test('rejects pending research jobs', () => {
  const payload = basePackage({
    jobResearchRuns: [{ id: '88d9fa60-677e-48d0-93be-5c2fdd88a469', status: 'queued' }],
  });
  (payload.manifest as any).counts.jobResearchRuns = 1;
  const withoutManifest = { ...payload };
  delete (withoutManifest as any).manifest;
  (payload.manifest as any).payloadSha256 = createHash('sha256').update(JSON.stringify(withoutManifest)).digest('hex');
  assert.throws(() => normalizeUserDataPackage(payload), /pendientes/i);
});

test('rejects a tampered package hash', () => {
  const payload = basePackage();
  (payload.manifest as any).payloadSha256 = '0'.repeat(64);
  assert.throws(() => normalizeUserDataPackage(payload), /hash.*coincide/i);
});

