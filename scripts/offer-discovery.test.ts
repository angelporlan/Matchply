import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryIdentity, discoveryUrl, parseDiscoveredOffers, searchMatchingOffers } from '@/lib/offer-discovery/search';
import { DiscoveryError } from '@/lib/offer-discovery/types';
import type { ResponsesResult } from '@/lib/offer-import/service';
import es from '@/lib/i18n/es';
import en from '@/lib/i18n/en';

const description = 'Requirements: React, TypeScript and experience building production web interfaces. Responsibilities: ship and maintain accessible user interfaces.';
const offer = (patch: Record<string, unknown> = {}) => ({ title: 'Frontend Engineer', company: 'Acme', url: 'https://jobs.example.com/jobs/123', description,
  active: true, location: 'Madrid', workplace: 'Remote', salary: null, publishedAt: '2026-10-01', closingDate: null, ...patch });
const parse = (items: unknown[], sources = ['https://jobs.example.com/jobs/123']) => parseDiscoveredOffers(JSON.stringify({ offers: items }), sources, '2026-10-12');
const result = (text: string, sources?: string[]): ResponsesResult => ({ status: 'completed', output: [
  ...(sources ? [{ type: 'web_search_call', action: { type: 'search', sources: sources.map(url => ({ url })) } }] : []),
  { type: 'message', content: [{ type: 'output_text', text }] },
] });

test('discovery retains only active, dated and cited individual job offers', () => {
  const items = parse([offer()]);
  assert.equal(items.length, 1);
  assert.equal(items[0].description, description);
  assert.deepEqual(items[0].sources, ['https://jobs.example.com/jobs/123']);
  for (const patch of [{ url: 'https://invented.example/jobs/2' }, { active: false }, { closingDate: '2026-10-11' },
    { publishedAt: '2026-10-13' }, { publishedAt: '2026-02-30' }, { description: 'Short summary' }, { company: '' }, { salary: 45000 }]) {
    assert.deepEqual(parse([offer(patch)]), []);
  }
});

test('discovery normalizes tracking and LinkedIn slugs without collapsing different job IDs', () => {
  assert.equal(discoveryUrl('https://jobs.example.com/jobs/123?utm_source=test#apply'), 'https://jobs.example.com/jobs/123');
  assert.equal(discoveryIdentity('https://www.linkedin.com/jobs/view/frontend-123/?trk=x'), 'linkedin:123');
  assert.equal(discoveryIdentity('https://jobs.example.com/job?id=123&utm_campaign=a'), discoveryIdentity('http://www.jobs.example.com/job?id=123'));
  assert.notEqual(discoveryIdentity('https://jobs.example.com/job?id=123'), discoveryIdentity('https://jobs.example.com/job?id=124'));
  assert.equal(parse([offer({ url: 'https://jobs.example.com/jobs/123?utm_source=a' }), offer()]).length, 1);
});

test('private, unrelated, uncited and listing URLs cannot become candidatures', () => {
  for (const url of ['http://127.0.0.1/jobs/123', 'http://localhost/jobs/123', 'http://10.0.0.1/jobs/123', 'https://jobs.example.com/search', 'https://www.linkedin.com/jobs/search/?keywords=React']) {
    assert.deepEqual(parse([offer({ url })], [url]), []);
  }
  assert.deepEqual(parse([offer()], []), []);
  assert.throws(() => parseDiscoveredOffers('broken', []), DiscoveryError);
  assert.throws(() => parse(Array.from({ length: 9 }, () => offer())), DiscoveryError);
});

test('search requires an actual web tool call then structures only its cited evidence', async () => {
  const calls: Record<string, unknown>[] = [];
  const offers = await searchMatchingOffers('Candidate evidence: React, Madrid, remote.', { apiKey: 'test-key',
    respond: async body => {
      calls.push(body);
      return calls.length === 1 ? result('Vacancy evidence', ['https://jobs.example.com/jobs/123']) : result(JSON.stringify({ offers: [offer()] }));
    },
  });
  assert.equal(offers.length, 1);
  assert.equal(calls[0].tool_choice, 'required');
  assert.deepEqual(calls[0].include, ['web_search_call.action.sources']);
  assert.equal((calls[0].tools as Array<{ type: string }>)[0].type, 'web_search');
  assert.match(String(calls[0].instructions), /Never put the candidate's name/);
  assert.equal(calls[1].input, 'Vacancy evidence');
  await assert.rejects(searchMatchingOffers('Candidate', { apiKey: 'test-key', respond: async () => result('Invented vacancy') }), /DISCOVERY_SEARCH_REQUIRED/);
});

test('empty search results are valid and refusal or incomplete responses fail', async () => {
  let call = 0;
  assert.deepEqual(await searchMatchingOffers('Candidate', { apiKey: 'test-key', respond: async () =>
    ++call === 1 ? result('No suitable jobs found.', []) : result('{"offers":[]}'),
  }), []);
  await assert.rejects(searchMatchingOffers('Candidate', { apiKey: 'test-key', respond: async () => ({ ...result('partial', []), status: 'incomplete' }) }), /DISCOVERY_INVALID_RESPONSE/);
});

test('discovery has complete matching Spanish and English messages', () => {
  assert.deepEqual(Object.keys(es.offerDiscovery), Object.keys(en.offerDiscovery));
  assert.deepEqual(Object.keys(es.offerDiscovery.stages), Object.keys(en.offerDiscovery.stages));
  assert.deepEqual(Object.keys(es.offerDiscovery.errors), Object.keys(en.offerDiscovery.errors));
});
