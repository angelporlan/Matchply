import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { load } from 'cheerio';
import { offerNeedsDescriptionLookup } from '@/lib/matching/description-lookup';

const require = createRequire(import.meta.url);
const reader = require('../chrome-extension/public-description.js');
const jobId = '4478152433';
const description = 'Responsabilidades: desarrollar soluciones de software y participar en revisiones.\nRequisitos: mínimo 3 años de experiencia, Java y AWS.';

function documentFrom(html: string) {
  const $ = load(html);
  const wrap = (el: any): any => {
    if (!el || (el.type !== 'tag' && el.type !== 'script')) return null;
    return {
      textContent: $(el).text(),
      innerHTML: $(el).html() || '',
      querySelector: (selector: string) => wrap($(el).find(selector)[0]),
      querySelectorAll: (selector: string) => $(el).find(selector).toArray().map(wrap),
    };
  };
  return {
    querySelector: (selector: string) => wrap($(selector)[0]),
    querySelectorAll: (selector: string) => $(selector).toArray().map(wrap),
  };
}

function read(html: string, id = jobId) {
  return reader.read(documentFrom(html), id, html);
}

test('a guest fragment keeps the description and separates list items', () => {
  const html = `<div data-job-id="${jobId}"><div class="show-more-less-html__markup"><ul><li>producción.</li><li>Requisitos sólidos de Java.</li><li>Experiencia con AWS en equipos de producto durante tres años.</li></ul></div></div>`;
  const text = read(html);
  assert.match(text, /producción\.\nRequisitos sólidos de Java\./);
  assert.equal(text.includes('producción.Requisitos'), false);
});

test('JSON-LD for the same job id is accepted and another job is not', () => {
  const posting = { '@type': 'JobPosting', url: `https://www.linkedin.com/jobs/view/${jobId}/`, description: `<p>${description.replace(/\n/g, '</p><p>')}</p>` };
  const html = `<script type="application/ld+json">${JSON.stringify(posting)}</script>`;
  assert.match(read(html), /mínimo 3 años/);
  assert.equal(read(html, '999999999'), '');
  const other = { ...posting, url: 'https://www.linkedin.com/jobs/view/999999999/' };
  assert.equal(read(`<!-- ${jobId} --><script type="application/ld+json">${JSON.stringify(other)}</script><div class="show-more-less-html__markup"><p>${description}</p></div>`), '');
});

test('short text is ignored and a sign-in link does not stop a real description', () => {
  assert.equal(read(`<div class="show-more-less-html__markup">${jobId} corto</div>`), '');
  const html = `<a href="/login">Inicia sesión</a><div class="show-more-less-html__markup"><p>${description}</p><p>Id ${jobId}</p></div>`;
  assert.equal(reader.shouldStop({ status: 200, type: 'basic', redirected: false, url: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`, html }), false);
  assert.match(read(html), /mínimo 3 años/);
});

test('a rate limit, an opaque redirect and a bot page stop the batch', () => {
  assert.equal(reader.shouldStop({ status: 429, type: 'basic', url: '', html: '' }), true);
  assert.equal(reader.shouldStop({ status: 302, type: 'basic', url: 'https://www.linkedin.com/authwall' }), true);
  assert.equal(reader.shouldStop({ status: 0, type: 'opaqueredirect', redirected: false, url: '', html: '' }), true);
  assert.equal(reader.shouldStop({ status: 200, type: 'basic', url: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`, html: '<html><script>var _0x26bb58=_0x3a5d;</script></html>' }), true);
  assert.equal(reader.isBotPage('<meta http-equiv="refresh" content="1;url=https://www.linkedin.com">'), true);
});

test('the service worker requests only the guest fragment and does not follow redirects', async () => {
  const calls: Array<{ url: string; init: any }> = [];
  let handler: (message: any, sender: any, reply: (value: any) => void) => void = () => {};
  runInNewContext(`${readFileSync('chrome-extension/people.js', 'utf8')}\n${readFileSync('chrome-extension/background.js', 'utf8')}`, {
    URL, setTimeout, clearTimeout, importScripts: () => {},
    chrome: {
      storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
      action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} },
      runtime: { onMessage: { addListener: (fn: typeof handler) => { handler = fn; } } },
    },
    fetch: async (url: string, init: any) => {
      calls.push({ url, init });
      return { status: 200, type: 'basic', redirected: false, url, text: async () => `<div>${jobId}</div>` };
    },
  });
  const send = (message: object, url = 'https://www.linkedin.com/jobs/search/') => new Promise<any>(resolve => handler(message, { url, tab: { id: 1, url } }, resolve));
  const page = await send({ type: 'read-public-job-html', jobId });
  assert.equal(page.status, 200);
  assert.equal(page.html.includes(jobId), true);
  assert.equal(calls[0].url, `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`);
  assert.equal(calls[0].init.credentials, 'omit');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.redirect, 'manual');
  const invalid = await send({ type: 'read-public-job-html', jobId: 'abc' });
  assert.equal(invalid.status, 0);
  assert.equal(calls.length, 1);
  const outside = await send({ type: 'read-public-job-html', jobId }, 'https://www.linkedin.com/feed/');
  assert.equal(outside.status, 0);
  assert.equal(calls.length, 1);
});

test('a saved public description is not fetched again', () => {
  const card = 'IA Engineer\nknowmad mood\nMadrid\nHíbrido';
  const list = { title: 'IA Engineer', company: 'knowmad mood', description: card, sourceMetadata: { captureKind: 'list', location: 'Madrid', workplaceType: 'Híbrido' } };
  assert.equal(offerNeedsDescriptionLookup(list), true);
  const saved = { ...list, description, sourceMetadata: { captureKind: 'detail', descriptionSource: 'public_page', location: 'Madrid', workplaceType: 'Híbrido' } };
  assert.equal(offerNeedsDescriptionLookup(saved), false);
});

test('visible capture reads public html without clicking or calling LinkedIn itself', () => {
  const content = readFileSync('chrome-extension/content.js', 'utf8');
  assert.match(content, /read-public-job-html/);
  assert.match(content, /stop-descriptions/);
  assert.match(content, /sin usar tu sesión/);
  assert.equal(content.includes('jobs-guest'), false);
  assert.equal(content.includes('openVisibleCard'), false);
  assert.equal(content.includes('job-card-container__link'), false);
});
