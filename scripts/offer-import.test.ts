import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { request as httpRequest } from 'node:http';
import { extractOffer } from '@/lib/offer-import/extract';
import { assertPublicOfferUrl, downloadPublicPage, isPublicAddress, MAX_PAGE_BYTES } from '@/lib/offer-import/public-page';
import { callOfferResponses, importOffer, OfferImportError, parseStructuredOffer, responseText, type ImportDependencies, type ResponsesResult } from '@/lib/offer-import/service';
import { normalizeOfferUrl, offerPlatform, sameOfferUrl } from '@/lib/offer-import/types';

const url = 'https://www.linkedin.com/jobs/view/4465816694/';
const description = 'Responsabilidades: desarrollar soluciones de software, participar en revisiones y asegurar la calidad.\nRequisitos: mínimo 3 años de experiencia, Java, Angular, AWS y CI/CD.\nCondiciones: jornada completa y trabajo híbrido.';
const posting = { '@type': 'JobPosting', url, title: 'Software Engineer', hiringOrganization: { name: 'Example' }, description: `<p>${description.replace(/\n/g, '</p><p>')}</p>` };
const html = (value: unknown) => `<html><script type="application/ld+json">${JSON.stringify(value)}</script></html>`;
const response = (value: unknown): ResponsesResult => ({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: typeof value === 'string' ? value : JSON.stringify(value) }] }] });
const structured = { isJobOffer: true, jobTitle: 'Software Engineer', company: 'Example', jobDescription: description };
const dependencies: ImportDependencies = { apiKey: 'test-only', download: async () => ({ html: html(posting), url, visitedUrls: [url] }), respond: async () => response(structured) };

test('LinkedIn tracking is stripped; functional parameters on other portals survive', () => {
  assert.equal(normalizeOfferUrl(`${url}?eBP=secret&trackingId=xyz#details`), url);
  assert.equal(normalizeOfferUrl('https://jobs.example.com/apply?job=123#details'), 'https://jobs.example.com/apply?job=123');
  assert.equal(offerPlatform('https://es.linkedin.com/jobs/view/role-4465816694'), 'linkedin');
  assert.equal(offerPlatform('https://linkedin.com.evil.test/job'), 'other');
  assert.ok(sameOfferUrl('https://es.linkedin.com/jobs/view/engineer-4465816694', url));
  assert.equal(sameOfferUrl('https://linkedin.com/jobs/view/999/', url), false);
  assert.equal(sameOfferUrl('https://evil.test/jobs/view/4465816694/', url), false);
  assert.equal(sameOfferUrl('https://user:secret@linkedin.com/jobs/view/4465816694/', url), false);
  assert.equal(sameOfferUrl('file://linkedin.com/jobs/view/4465816694/', url), false);
});

test('SSRF guard blocks private, reserved, mapped addresses and credential URLs', () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '172.31.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '192.0.2.1', '224.0.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2001:db8::1']) {
    assert.equal(isPublicAddress(address), false, address);
    assert.throws(() => assertPublicOfferUrl(`http://${address.includes(':') ? `[${address}]` : address}/`));
  }
  assert.ok(isPublicAddress('8.8.8.8'));
  assert.ok(isPublicAddress('2606:4700:4700::1111'));
  for (const value of ['file:///etc/passwd', 'http://localhost/job', 'http://x.local/job', 'https://user:secret@example.com/', 'https://example.com:8443/', 'https://linkedin.com/feed/']) assert.throws(() => assertPublicOfferUrl(value));
});

test('JSON-LD objects, arrays and @graph preserve the full source description', () => {
  for (const value of [posting, [posting], { '@graph': [{ '@type': 'Organization' }, posting] }]) {
    const result = extractOffer(html(value), url);
    assert.equal(result?.jobTitle, posting.title);
    assert.equal(result?.company, 'Example');
    assert.ok(result?.description.includes('mínimo 3 años'));
    assert.ok(result?.description.includes('trabajo híbrido'));
  }
  const encoded = posting.description.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const result = extractOffer(html({ ...posting, description: encoded }), url);
  assert.equal(result?.description.includes('<p>'), false);
  assert.ok(result?.description.includes('mínimo 3 años'));
  assert.ok(result?.description.includes('trabajo híbrido'));
});

test('Dedicated HTML extraction excludes similar offers and handles malformed JSON-LD', () => {
  const result = extractOffer(`<script type="application/ld+json">broken</script><h1>Engineer</h1><a class="topcard__org-name-link">Example</a><div class="show-more-less-html__markup"><p>${description}</p><aside>Other role</aside><div class="similar-job">WRONG JOB</div></div>`, url);
  assert.equal(result?.company, 'Example');
  assert.ok(result?.description.includes('AWS'));
  assert.equal(result?.description.includes('WRONG JOB'), false);
  assert.equal(extractOffer('<form>Log in</form>', url), null);
});

test('Multiple JSON-LD postings are matched by job ID rather than selected by position', () => {
  const other = { ...posting, url: 'https://linkedin.com/jobs/view/999/', title: 'Wrong role' };
  assert.equal(extractOffer(html([other, posting]), url)?.jobTitle, posting.title);
  assert.equal(extractOffer(html([other, { ...other, url: 'https://linkedin.com/jobs/view/888/' }]), url), null);
  assert.equal(extractOffer(html(other) + `<main>${description}</main>`, url), null);
});

function fakeRequest(pages: Array<{ redirect?: string; content?: string }>, seen: string[]) {
  return ((target: URL, options: Record<string, unknown>, callback: (response: PassThrough) => void) => {
    seen.push(target.toString());
    const lookup = options.lookup as (host: string, options: object, callback: (...args: unknown[]) => void) => void;
    lookup(target.hostname, {}, (error, address) => { assert.equal(error, null); assert.equal(address, '8.8.8.8'); });
    const page = pages.shift()!;
    const request = new EventEmitter();
    Object.assign(request, { end: () => queueMicrotask(() => {
      const response = Object.assign(new PassThrough(), {
        statusCode: page.redirect ? 302 : 200,
        headers: page.redirect ? { location: page.redirect } : { 'content-type': 'text/html' },
      });
      callback(response);
      if (!page.redirect) response.end(page.content || '');
    }) });
    return request;
  }) as unknown as typeof httpRequest;
}

test('Downloader pins DNS, checks every redirect, limits bytes and aborts pending DNS', async () => {
  const seen: string[] = [];
  const resolveHost = async () => ({ address: '8.8.8.8', family: 4 });
  await assert.rejects(downloadPublicPage('https://jobs.example.com/job', undefined, {
    resolveHost, request: fakeRequest([{ redirect: 'http://127.0.0.1/private' }], seen),
  }), /OFFER_URL_BLOCKED/);
  assert.equal(seen.length, 1);
  await assert.rejects(downloadPublicPage('https://jobs.example.com/job', undefined, {
    resolveHost: async () => ({ address: '10.0.0.1', family: 4 }),
    request: (() => { assert.fail('Private DNS must not open a socket'); }) as typeof httpRequest,
  }), /OFFER_URL_BLOCKED/);
  await assert.rejects(downloadPublicPage('https://jobs.example.com/job', undefined, {
    resolveHost, request: fakeRequest([{ content: 'x'.repeat(MAX_PAGE_BYTES + 1) }], []),
  }), /OFFER_PAGE_TOO_LARGE/);
  await assert.rejects(downloadPublicPage('https://jobs.example.com/job', undefined, {
    resolveHost, request: fakeRequest(Array.from({ length: 4 }, () => ({ redirect: '/again' })), []),
  }), /OFFER_REDIRECT_LIMIT/);
  const controller = new AbortController();
  const pending = downloadPublicPage('https://jobs.example.com/job', controller.signal, {
    resolveHost: () => new Promise(() => {}),
  });
  controller.abort(new Error('test deadline'));
  await assert.rejects(pending, /test deadline/);
});

test('Direct import structures with Luna and never calls web search or summarizes isolated text', async () => {
  const calls: Record<string, unknown>[] = [];
  const stages: string[] = [];
  const result = await importOffer(url, { ...dependencies,
    respond: async body => { calls.push(body); return response({ ...structured, jobDescription: description.slice(0, 100) }); },
    onProgress: async stage => { stages.push(stage); },
  });
  assert.equal(result.sourceMethod, 'direct');
  assert.equal(result.jobDescription, extractOffer(html(posting), url)?.description);
  assert.equal(result.jobTitle, posting.title);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tools, undefined);
  assert.ok((calls[0].instructions as string).includes('untrusted data'));
  assert.deepEqual(stages, ['reading', 'structuring']);
});

test('Unavailable public page uses required web search, matching citations, then strict structuring', async () => {
  const calls: Record<string, unknown>[] = [];
  const result = await importOffer(url, { ...dependencies, download: async () => { throw new Error('blocked by portal'); },
    respond: async body => {
      calls.push(body);
      return body.tools ? { ...response(description), output: [{ type: 'web_search_call', action: { sources: [{ url: 'https://es.linkedin.com/jobs/view/engineer-4465816694/' }] } }, ...response(description).output!] } : response(structured);
    },
  });
  assert.equal(result.sourceMethod, 'web_search');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].tool_choice, 'required');
  assert.ok(calls[1].text);
});

test('Unrelated source or changed LinkedIn job ID must not produce a successful import', async () => {
  let calls = 0;
  await assert.rejects(importOffer(url, { ...dependencies,
    download: async () => ({ html: html({ ...posting, url: 'https://linkedin.com/jobs/view/999/' }), url: 'https://linkedin.com/jobs/view/999/', visitedUrls: [url, 'https://linkedin.com/jobs/view/999/'] }),
    respond: async () => { calls++; return { ...response(description), output: [{ type: 'web_search_call', action: { sources: [{ url: 'https://linkedin.com/jobs/view/999/' }] } }, ...response(description).output!] }; },
  }), /OFFER_SOURCE_MISMATCH/);
  assert.equal(calls, 1);
});

test('Blocked redirect never reaches OpenAI, and absent configuration never simulates an offer', async () => {
  await assert.rejects(importOffer(url, { ...dependencies, download: async () => { throw new Error('OFFER_URL_BLOCKED'); }, respond: async () => { assert.fail('OpenAI must not be called'); } }), /OFFER_URL_BLOCKED/);
  await assert.rejects(importOffer(url, { ...dependencies, apiKey: '' }), /OFFER_AI_NOT_CONFIGURED/);
});

test('Invalid, incomplete and refused model outputs fail explicitly', () => {
  assert.throws(() => parseStructuredOffer('not JSON'), /OFFER_AI_INVALID/);
  assert.throws(() => parseStructuredOffer(JSON.stringify({ ...structured, isJobOffer: false })), /OFFER_NOT_FOUND/);
  assert.throws(() => parseStructuredOffer(JSON.stringify({ ...structured, jobDescription: 'too short' })), /OFFER_NOT_FOUND/);
  assert.throws(() => responseText({ status: 'incomplete' }), /OFFER_AI_INCOMPLETE/);
  assert.throws(() => responseText({ output: [{ content: [{ type: 'refusal' }] }] }), /OFFER_AI_REFUSED/);
  assert.equal(new OfferImportError('OFFER_AI_HTTP_429', true).retryable, true);
});

test('Provider errors do not start a redundant web search when direct download succeeded', async () => {
  let calls = 0;
  await assert.rejects(importOffer(url, { ...dependencies, respond: async () => { calls++; throw new OfferImportError('OFFER_AI_HTTP_429', true); } }), /OFFER_AI_HTTP_429/);
  assert.equal(calls, 1);
});

test('Provider transport and body timeouts retry; invalid JSON and authorization errors do not', async t => {
  const controller = new AbortController();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 429 }));
  const retryable = (error: unknown) => error instanceof OfferImportError && error.retryable;
  await assert.rejects(callOfferResponses({}, controller.signal, 'test-only'), retryable);
  fetchMock.mock.mockImplementation(async () => new Response('', { status: 401 }));
  await assert.rejects(callOfferResponses({}, controller.signal, 'test-only'), error => error instanceof OfferImportError && !error.retryable);
  fetchMock.mock.mockImplementation(async () => new Response('not JSON', { status: 200 }));
  await assert.rejects(callOfferResponses({}, controller.signal, 'test-only'), error => error instanceof OfferImportError && !error.retryable);
  const bodyResponse = new Response('{}', { status: 200 });
  t.mock.method(bodyResponse, 'json', async () => { controller.abort(); throw new Error('body interrupted'); });
  fetchMock.mock.mockImplementation(async () => bodyResponse);
  await assert.rejects(callOfferResponses({}, controller.signal, 'test-only'), retryable);
  fetchMock.mock.mockImplementation(async () => { throw new TypeError('connection reset'); });
  await assert.rejects(callOfferResponses({}, new AbortController().signal, 'test-only'), retryable);
});
