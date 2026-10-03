import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function background(result: Record<string, unknown>) {
  const storage: Record<string, any> = { matchplyExtensionToken: 'fixture-token', matchplyExtensionScope: 'linkedin:ingest', matchplyExtensionInstallation: { id: 'installation-a' } };
  const calls: Array<{ url: string; body: any }> = [];
  let handler: (message: any, sender: any, reply: (r: any) => void) => void;
  runInNewContext(readFileSync('chrome-extension/background.js', 'utf8'), {
    chrome: { storage: { local: { get: async (keys: string | string[]) => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map(k => [k, storage[k]])), set: async (values: object) => Object.assign(storage, values), remove: async (keys: string[]) => keys.forEach(k => delete storage[k]) } }, action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} }, runtime: { onMessage: { addListener: (fn: typeof handler) => { handler = fn; } } } },
    fetch: async (url: string, init: { body: string }) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, json: async () => result }; },
  });
  return { storage, calls, send: (message: object) => new Promise<any>(resolve => handler(message, { tab: { id: 1 } }, resolve)) };
}
const person = { name: 'Ana', profileUrl: 'https://www.linkedin.com/in/ana', headline: 'Recruiter', connectionDegree: '2nd', source: 'hiring_team' };
test('background accepts a legacy offer, routes late people separately and scopes state to an installation', async () => {
  const bg = background({ success: true });
  const old = await bg.send({ type: 'capture-linkedin-job', payload: { job_id: '123', title: 'Engineer', company: 'Client', description: 'Offer description' } });
  assert.ok(old.ok); assert.ok(bg.calls[0].url.endsWith('/linkedin/ingest')); assert.equal(bg.calls[0].body.people, undefined);
  const late = await bg.send({ type: 'capture-linkedin-people', payload: { sourceJobId: '123', people: [person] } });
  assert.ok(late.ok); assert.ok(bg.calls[1].url.endsWith('/linkedin/people')); assert.deepEqual(bg.calls[1].body, { sourceJobId: '123', people: [person] });
  assert.equal(bg.storage.matchply_capture_installation_a, undefined);
  assert.equal(bg.storage['matchply_capture_installation-a_123'].offer, true); assert.equal(bg.storage['matchply_capture_installation-a_123'].people.length, 1);
  bg.storage.matchplyExtensionInstallation = { id: 'installation-b' };
  await bg.send({ type: 'capture-linkedin-job', payload: { job_id: '123', title: 'Engineer', company: 'Client' } });
  assert.equal(bg.storage['matchply_capture_installation-b_123'].people.length, 0); assert.equal(bg.storage['matchply_capture_installation-a_123'].people.length, 1);
});
test('a partial people failure records the saved offer and keeps contacts eligible for retry', async () => {
  const bg = background({ success: true, peopleError: 'PEOPLE_CAPTURE_FAILED' });
  const r = await bg.send({ type: 'capture-linkedin-job', payload: { job_id: '123', title: 'Engineer', company: 'Client', people: [person] } });
  assert.ok(r.ok); assert.equal(bg.storage['matchply_capture_installation-a_123'].offer, true); assert.equal(bg.storage['matchply_capture_installation-a_123'].people.length, 0);
});
