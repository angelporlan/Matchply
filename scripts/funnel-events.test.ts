import test from 'node:test';
import assert from 'node:assert/strict';
import { createUmamiClient, type UmamiPayload } from '@/lib/umami-client';
import { funnelData, offerAnalyticsDomain } from '@/lib/umami';

test('offer metadata keeps only a public hostname and fixed product properties', () => {
  assert.equal(offerAnalyticsDomain('https://user:secret@www.linkedin.com/jobs/view/123?cv=private'), 'linkedin.com');
  for (const url of ['http://127.0.0.1/a', 'http://[::1]/a', 'http://localhost', 'file:///private', 'https://foo.internal', 'https://abc.test']) assert.equal(offerAnalyticsDomain(url), undefined);
  const data = funnelData('offer_import_failed', { method: 'url', domain: 'https://jobs.example.org/job/private?email=a@b.c', error_code: 'OFFER_PORTAL_BLOCKED', content: 'PRIVATE CV', requestId: 'private-id' } as never);
  assert.deepEqual(data, { method: 'url', domain: 'jobs.example.org', error_code: 'OFFER_PORTAL_BLOCKED' });
  assert.deepEqual(funnelData('cv_optimization_failed', { error_code: 'sk-private provider body', mode: 'private CV text' }), { error_code: 'UNEXPECTED_ERROR' });
  assert.deepEqual(funnelData('signup_completed', { domain: 'linkedin.com', method: 'url', error_code: 'SQL SELECT' }), {});
});

test('funnel counts route entry and each optimization outcome once while preserving a failed retry recovery', () => {
  const events: UmamiPayload[] = [];
  const page = { pathname: '/', title: 'Private CV title', referrer: '', doNotTrack: false };
  let ready = false;
  const client = createUmamiClient({ page: () => page, storage: () => null,
    transport: () => ready ? transform => events.push(transform({ website: 'test', url: 'private', data: { email: 'private' }, id: 'private' })) : undefined });
  client.configure({ enabled: true, administrator: false, impersonating: false, experiment: { enabled: false, variant: null } });
  client.pageview(); client.pageview(); page.pathname = '/try'; client.pageview(); client.pageview();
  client.conversion('cv_optimization_started', { mode: 'optimize_adapted' }, 'request-private');
  client.conversion('cv_optimization_failed', { error_code: 'NETWORK_ERROR' }, 'request-private');
  client.conversion('cv_optimization_started', {}, 'request-private');
  client.conversion('cv_optimized', {}, 'request-private'); client.conversion('cv_optimized', {}, 'request-private');
  ready = true; client.flush(); client.flush();
  assert.deepEqual(events.filter(event => event.name).map(event => event.name), ['landing_viewed', 'trial_started', 'cv_optimization_started', 'cv_optimization_failed', 'cv_optimized']);
  assert.doesNotMatch(JSON.stringify(events), /private|email|request-private/);
  assert.deepEqual(events.find(event => event.name === 'cv_optimization_failed')?.data, { error_code: 'NETWORK_ERROR' });
  page.doNotTrack = true;
  assert.equal(client.conversion('offer_imported', { method: 'url', domain: 'linkedin.com' }), false);
  assert.equal(events.length, 7);
});
