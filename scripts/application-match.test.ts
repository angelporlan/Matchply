import test from 'node:test';
import assert from 'node:assert/strict';
import { applicationMatchStrategy, normalizeStatus } from '@/lib/application-service';

test('external identity wins over URL and title', () => {
  assert.deepEqual(
    applicationMatchStrategy({
      externalSource: 'linkedin',
      externalId: 'abc',
      url: 'https://jobs.example/1',
      title: 'Engineer',
      company: 'Acme',
    }),
    { strategy: 'external', externalSource: 'linkedin', externalId: 'abc' },
  );
});

test('URL is used when there is no stable external identity', () => {
  assert.deepEqual(
    applicationMatchStrategy({
      url: 'https://jobs.example/1',
      title: 'Engineer',
      company: 'Acme',
    }),
    { strategy: 'url', url: 'https://jobs.example/1' },
  );
});

test('title+company is only the legacy fallback', () => {
  assert.deepEqual(
    applicationMatchStrategy({ title: 'Engineer', company: 'Acme' }),
    { strategy: 'title_company', title: 'Engineer', company: 'Acme' },
  );
  assert.equal(applicationMatchStrategy({ title: 'Engineer' }), null);
});

test('unknown pipeline statuses fall back to interested', () => {
  assert.equal(normalizeStatus('interview'), 'interview');
  assert.equal(normalizeStatus('archived:applied'), 'interested');
  assert.equal(normalizeStatus(undefined), 'interested');
});
