import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from 'cheerio';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { linkedinUrl, personInput, date, captureInput } from '@/lib/people/validation';
import { conversationChunks, conversationText, contentHash, parseMessageRanges, markOverlaps } from '@/lib/people/conversations';
import { validateAdvice } from '@/lib/people/ai';
import { canAccessFeature } from '@/lib/subscription';
import { parseAiRuntimeConfig, resolveModelForFunction } from '@/lib/ai-runtime-config';

const require = createRequire(import.meta.url);
const extractor = require('../chrome-extension/people.js');

test('networking and extension are registered features; research and agents remain Pro', () => {
  for (const status of ['none', 'active', 'trialing', 'canceled']) for (const feature of ['networking', 'linkedinExtension'] as const) assert.ok(canAccessFeature(status, feature));
  for (const feature of ['networking', 'linkedinExtension'] as const) assert.equal(canAccessFeature('none', feature, { isGuest: true }), false);
  assert.equal(canAccessFeature('none', 'agentApi'), false);
  assert.equal(canAccessFeature('none', 'deepResearch'), false);
  for (const plan of ['free', 'pro'] as const) assert.deepEqual(resolveModelForFunction(parseAiRuntimeConfig({}), 'networking', plan).ref, { provider: 'openai', model: 'gpt-6-luna' });
});
test('profile validation and canonical URLs cannot merge names or accept foreign URLs', () => {
  assert.equal(linkedinUrl('https://es.linkedin.com/in/Ana-Recruiter/?tracking=1#x'), 'https://www.linkedin.com/in/ana-recruiter');
  for (const bad of ['https://linkedin.com.evil.test/in/ana', 'http://linkedin.com/in/ana', 'https://user:pass@linkedin.com/in/ana', 'https://linkedin.com/in/ana%2Ftest', 'https://linkedin.com/jobs/view/1', 'https://linkedin.com:8080/in/ana']) assert.throws(() => linkedinUrl(bad));
  assert.equal(personInput({ name: ' Ana ' }).name, 'Ana');
  assert.equal(personInput({ name: 'Ana' }).linkedinUrl, null);
  assert.throws(() => personInput({ name: 'Ana', email: 'broken' }));
  assert.throws(() => personInput({ name: '' }));
  assert.throws(() => personInput({ name: 'Ana', status: 'invented' }));
  for (const value of ['2026-02-30', '2026-02-30T12:00:00Z', 'tomorrow', '2026-10-03T12:30']) assert.throws(() => date(value));
  assert.equal(date('2026-10-03')?.toISOString(), '2026-10-03T12:00:00.000Z');
  assert.throws(() => captureInput(Array.from({ length: 21 }, () => ({}))));
});
test('conversation boundaries retain the original and literal message bodies', () => {
  const raw = 'Ana\r\nHola  mundo\r\nTú\r\nGracias\r\nAna\r\nGracias';
  assert.equal(conversationText(raw), raw);
  const [lines] = conversationChunks(raw);
  const messages = parseMessageRanges(raw, lines, [{ startLine: 2, endLine: 2, author: 'contact', sentAt: null, uncertain: true }, { startLine: 4, endLine: 4, author: 'self', sentAt: null, uncertain: true }, { startLine: 6, endLine: 6, author: 'contact', sentAt: null, uncertain: true }]);
  assert.equal(messages[0].content, 'Hola  mundo');
  assert.equal(messages[1].content, messages[2].content);
  assert.throws(() => parseMessageRanges(raw, lines, [{ startLine: 1, endLine: 2, author: 'self', sentAt: null, uncertain: true }, { startLine: 2, endLine: 3, author: 'contact', sentAt: null, uncertain: true }]));
  assert.throws(() => parseMessageRanges(raw, lines, [{ startLine: 1, endLine: 100, author: 'self', sentAt: null, uncertain: false }]));
  assert.throws(() => conversationText('x'.repeat(120001)));
  const long = 'x'.repeat(119999);
  const chunks = conversationChunks(long);
  assert.equal(chunks.flat().map(l => l.content).join(''), long);
  assert.ok(chunks.every(c => c.reduce((n, l) => n + l.content.length, 0) <= 18000));
  assert.equal(contentHash({ text: 'a' }), contentHash({ text: 'a' }));
  assert.equal(contentHash({ b: 2, a: 1 }), contentHash({ a: 1, b: 2 }));
});
test('overlaps compare ordered exchanges, not a global set of message text', () => {
  const msg = (content: string, author: 'self' | 'contact' = 'self', sentAt: string | null = null) => ({ content, author, sentAt, uncertain: true });
  assert.equal(markOverlaps([msg('gracias')], [msg('gracias')])[0].overlap, false);
  assert.equal(markOverlaps([msg('gracias', 'contact')], [msg('gracias')])[0].overlap, false);
  const marked = markOverlaps([msg('hola'), msg('qué tal', 'contact')], [msg('hola'), msg('qué tal', 'contact'), msg('gracias'), msg('gracias')]);
  assert.deepEqual(marked.map(m => m.overlap), [true, true, false, false]);
  assert.equal(markOverlaps([msg('hola', 'self', '2026-10-03T12:00:00Z')], [msg('hola', 'self', '2026-10-03T12:00:00Z')])[0].overlap, true);
});
test('advice rejects malformed or invented dates instead of publishing a mock', () => {
  const advice = { facts: [], hypotheses: [], recommendations: [], hooks: [], questions: [], drafts: [], nextAction: null, followupDate: null };
  assert.deepEqual(validateAdvice(advice), advice);
  for (const bad of [{}, { ...advice, facts: 'x' }, { ...advice, drafts: [{ title: 'x' }] }, { ...advice, followupDate: '2026-02-30' }]) assert.throws(() => validateAdvice(bad));
});
function dom(html: string) {
  const $ = load(html);
  const wrap = (el: any): any => ({ textContent: $(el).text(), getAttribute: (n: string) => $(el).attr(n), getClientRects: () => $(el).closest('[hidden]').length ? [] : [{}], closest: (q: string) => $(el).closest(q).length ? {} : null, querySelector: (q: string) => $(el).find(q)[0] ? wrap($(el).find(q)[0]) : null, querySelectorAll: (q: string) => $(el).find(q).toArray().map(wrap) });
  return { querySelectorAll: (q: string) => $(q).toArray().map(wrap) };
}
test('LinkedIn extractor scopes to hiring cards and an open network modal, ignores summaries', () => {
  const html = `<a href="/in/unrelated">Unrelated</a><div class="display-flex">Yasser y otras personas</div><section class="job-details-people-who-can-help__section--two-pane"><div class="hirer-card__hirer-information"><a href="/in/ANA/?tracking=1"><span class="jobs-poster__name"><strong>Ana</strong></span></a><span class="hirer-card__connection-degree">2º</span><div class="linked-area"><div class="text-body-small">Recruiter at Agency</div></div></div></section><div role="dialog" class="job-details-connections-modal__modal-wrapper"><div class="job-details-people-who-can-help__connections-profile-card"><a href="/in/employee"><span class="job-details-people-who-can-help__connections-profile-card-title"><strong>Employee</strong></span></a><div class="artdeco-entity-lockup__subtitle">Engineer</div></div></div>`;
  const people = extractor.extract(dom(html));
  assert.equal(people.length, 2);
  assert.equal(people[0].profileUrl, 'https://www.linkedin.com/in/ana');
  assert.equal(people[0].source, 'hiring_team');
  assert.equal(people[0].headline, 'Recruiter at Agency');
  assert.equal(people[1].source, 'network');
  assert.equal(extractor.extract(dom(html.replace('role="dialog"', 'hidden role="dialog"'))).length, 1);
  assert.equal(extractor.extract(dom('<div class="job-details-connections-card">Yasser y otras personas de tu red</div>')).length, 0);
  assert.ok(!readFileSync('chrome-extension/people.js', 'utf8').includes('.click('));
});
