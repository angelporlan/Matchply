import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

function background(result: Record<string, unknown>, options: { downloadFailure?: boolean; uploadFailure?: boolean; capturePeople?: boolean } = {}) {
  const storage: Record<string, any> = { matchplyExtensionToken: 'fixture-token', matchplyExtensionScope: 'linkedin:ingest', matchplyExtensionInstallation: { id: 'installation-a' }, matchplyCapturePeople: options.capturePeople !== false };
  const calls: Array<{ url: string; body: any; init: any }> = [], sizes: number[][] = [];
  const jpeg = readFileSync('scripts/fixtures/person-avatar.jpg');
  let handler: (message: any, sender: any, reply: (r: any) => void) => void;
  runInNewContext(`${readFileSync('chrome-extension/people.js', 'utf8')}\n${readFileSync('chrome-extension/background.js', 'utf8')}`, {
    URL, Blob, AbortController, setTimeout, clearTimeout, importScripts: () => {},
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    createImageBitmap: async () => ({ width: 400, height: 200, close: () => {} }),
    OffscreenCanvas: class { constructor(width: number, height: number) { sizes.push([width, height]); } getContext() { return { fillRect: () => {}, drawImage: () => {} }; } async convertToBlob() { return new Blob([jpeg], { type: 'image/jpeg' }); } },
    chrome: { storage: { local: { get: async (keys: string | string[]) => Object.fromEntries((typeof keys === 'string' ? [keys] : keys).map(k => [k, storage[k]])), set: async (values: object) => Object.assign(storage, values), remove: async (keys: string[]) => keys.forEach(k => delete storage[k]) } }, action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} }, runtime: { onMessage: { addListener: (fn: typeof handler) => { handler = fn; } } } },
    fetch: async (url: string, init: any) => {
      calls.push({ url, body: init.body ? JSON.parse(init.body) : null, init });
      if (url.startsWith('https://media.licdn.com/')) return new Response(jpeg, { status: options.downloadFailure ? 503 : 200, headers: { 'content-type': 'image/jpeg' } });
      if (url.endsWith('/people/avatar')) return { ok: !options.uploadFailure };
      return { ok: true, json: async () => result };
    },
  });
  return { storage, calls, sizes, send: (message: object, url = 'https://www.linkedin.com/jobs/view/123/') => new Promise<any>(resolve => handler(message, { url, tab: { id: 1, url } }, resolve)) };
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
const withPhoto = { ...person, avatarUrl: 'https://media.licdn.com/dms/image/v2/fixture/profile-framedphoto-shrink_100_100/fixture?e=1' };
test('the extension saves metadata before a separate small photo and never forwards the Matchply token to the CDN', async () => {
  const bg = background({ success: true });
  const r = await bg.send({ type: 'capture-linkedin-people', payload: { sourceJobId: '123', people: [withPhoto] } });
  assert.ok(r.ok); assert.equal(r.result.avatarFailures, 0);
  assert.ok(bg.calls[0].url.endsWith('/linkedin/people')); assert.equal(bg.calls[0].body.people[0].avatarUrl, undefined);
  const download = bg.calls[1]; assert.equal(download.url, withPhoto.avatarUrl); assert.equal(download.init.credentials, 'omit'); assert.equal(download.init.redirect, 'error'); assert.equal(download.init.headers, undefined);
  const upload = bg.calls[2]; assert.ok(upload.url.endsWith('/people/avatar')); assert.equal(upload.body.profileUrl, person.profileUrl); assert.equal(upload.body.avatar.mime, 'image/jpeg'); assert.ok(Buffer.from(upload.body.avatar.data, 'base64').length <= 48 * 1024);
  assert.deepEqual(bg.sizes, [[192, 192]]); assert.equal(JSON.parse(r.result.capturedSignatures[0]).length, 6);
  assert.ok(!JSON.stringify(bg.storage).includes(upload.body.avatar.data));
});
test('photo download/upload failure keeps the contact and offer saved, with a pending photo signature and cooldown', async () => {
  for (const options of [{ downloadFailure: true }, { uploadFailure: true }]) {
    const bg = background({ success: true }, options);
    const r = await bg.send({ type: 'capture-linkedin-job', payload: { job_id: '123', title: 'Engineer', company: 'Client', people: [withPhoto] } });
    assert.ok(r.ok); assert.equal(r.result.avatarFailures, 1); assert.ok(r.result.avatarRetryAt > Date.now());
    const state = bg.storage['matchply_capture_installation-a_123']; assert.equal(state.offer, true); assert.equal(state.people.length, 1); assert.equal(JSON.parse(state.people[0]).length, 5);
  }
});
test('opt-out, invalid photo sources and messages outside job pages do not download images', async () => {
  const off = background({ success: true }, { capturePeople: false });
  await off.send({ type: 'capture-linkedin-people', payload: { sourceJobId: '123', people: [withPhoto] } }); assert.equal(off.calls.length, 1);
  const invalid = background({ success: true });
  await invalid.send({ type: 'capture-linkedin-people', payload: { sourceJobId: '123', people: [{ ...withPhoto, avatarUrl: 'https://evil.test/photo.jpg' }] } }); assert.equal(invalid.calls.length, 1);
  const foreign = await invalid.send({ type: 'capture-linkedin-people', payload: { sourceJobId: '123', people: [withPhoto] } }, 'https://evil.test/'); assert.equal(foreign.ok, false); assert.equal(invalid.calls.length, 1);
});
