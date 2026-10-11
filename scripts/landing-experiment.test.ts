import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import {
  LANDING_EXPERIMENT_COOKIE_NAME,
  LANDING_EXPERIMENT_HEADER_NAME,
  chooseLandingVariant,
  parseLandingExperimentValue,
  resolveLandingExperiment,
} from '@/lib/landing-experiment';
import { createUmamiClient, type UmamiClientConfig, type UmamiPayload, type UmamiTrack } from '@/lib/umami-client';

function productionTracking(t: TestContext) {
  const values = {
    NODE_ENV: 'production', UMAMI_ENABLED: 'true', UMAMI_AEPD_CLEARED: 'true',
    NEXT_PUBLIC_UMAMI_WEBSITE_ID: 'test-website', NEXT_PUBLIC_UMAMI_SCRIPT_URL: '/umami/script.js',
    NEXTAUTH_SECRET: 'test-only-secret-with-no-production-access',
  };
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}

function request(headers: Record<string, string> = {}, pathname = '/') {
  return new NextRequest(`https://matchply.example${pathname}`, { headers });
}

test('the experiment accepts only versioned variants and splits the random interval equally', () => {
  assert.equal(chooseLandingVariant(0), 'A');
  assert.equal(chooseLandingVariant(0.499999), 'A');
  assert.equal(chooseLandingVariant(0.5), 'B');
  assert.equal(chooseLandingVariant(0.999999), 'B');
  assert.equal(parseLandingExperimentValue('v1:A'), 'A');
  assert.equal(parseLandingExperimentValue('v2:A'), null);
  assert.equal(parseLandingExperimentValue('B'), null);
  assert.deepEqual(resolveLandingExperiment({ enabled: true, headerValue: 'v1:B', cookieValue: 'v1:A' }), { enabled: true, variant: 'B' });
  assert.deepEqual(resolveLandingExperiment({ enabled: false, cookieValue: 'v1:B' }), { enabled: false, variant: null });
});

test('middleware forwards the first assignment to SSR and persists the same private cookie', async (t) => {
  productionTracking(t);
  const response = await middleware(request());
  const assignment = response.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`);
  assert.ok(assignment === 'v1:A' || assignment === 'v1:B');
  const cookie = response.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME);
  assert.equal(cookie?.value, assignment);
  assert.equal(cookie?.httpOnly, true);
  assert.equal(cookie?.secure, true);
  assert.equal(cookie?.sameSite, 'lax');
  assert.equal(cookie?.maxAge, 7 * 24 * 3600);
  assert.equal(cookie?.path, '/');

  const revisit = await middleware(request({ cookie: `${LANDING_EXPERIMENT_COOKIE_NAME}=${assignment}`, [LANDING_EXPERIMENT_HEADER_NAME]: 'v1:forged' }));
  assert.equal(revisit.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`), assignment);
  assert.equal(revisit.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
});

test('middleware removes forged headers and skips disabled analytics, DNT, prefetch, support and other routes', async (t) => {
  productionTracking(t);
  const exclusions: Record<string, string>[] = [{ dnt: '1' }, { dnt: 'yes' }, { purpose: 'prefetch' }, { 'sec-purpose': 'prefetch' }, { 'next-router-prefetch': '1' }, { cookie: 'mp_support=test' }];
  for (const headers of exclusions) {
    const response = await middleware(request({ ...headers, [LANDING_EXPERIMENT_HEADER_NAME]: 'v1:B' }));
    assert.equal(response.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
    assert.equal(response.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`), null);
  }
  for (const key of ['UMAMI_ENABLED', 'UMAMI_AEPD_CLEARED', 'NEXT_PUBLIC_UMAMI_SCRIPT_URL']) {
    const previous = process.env[key];
    process.env[key] = '';
    const response = await middleware(request());
    assert.equal(response.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
    process.env[key] = previous;
  }
  const nonLanding = await middleware(request({}, '/try'));
  assert.equal(nonLanding.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
});

test('middleware assigns guests but excludes new signed-in participants without decoding sessions', async (t) => {
  productionTracking(t);
  const guest = await middleware(request({ cookie: 'matchply_guest=opaque-guest-token' }));
  assert.ok(guest.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME));
  for (const cookie of ['authjs.session-token=opaque', '__Secure-authjs.session-token=opaque', '__Secure-authjs.session-token.0=opaque; __Secure-authjs.session-token.1=opaque']) {
    const response = await middleware(request({ cookie }));
    assert.equal(response.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
    assert.equal(response.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`), null);
  }
});

test('an existing anonymous assignment survives signup without auth dependencies in middleware', async (t) => {
  productionTracking(t);
  delete process.env.NEXTAUTH_SECRET;
  const response = await middleware(request({ cookie: `authjs.session-token=opaque; ${LANDING_EXPERIMENT_COOKIE_NAME}=v1:B` }));
  assert.equal(response.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
  assert.equal(response.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`), 'v1:B');
});

test('prefetch does not assign but preserves an existing SSR variant for the router cache', async (t) => {
  productionTracking(t);
  const response = await middleware(request({ cookie: `${LANDING_EXPERIMENT_COOKIE_NAME}=v1:B`, 'next-router-prefetch': '1' }));
  assert.equal(response.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
  assert.equal(response.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`), null);
  const experiment = resolveLandingExperiment({
    enabled: true,
    headerValue: response.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`),
    cookieValue: 'v1:B',
  });
  assert.equal(experiment.variant, 'B');
});


function fixture() {
  const events: UmamiPayload[] = [];
  const stored = new Map<string, string>();
  const page = { pathname: '/', title: 'Matchply', referrer: 'https://example.com/path?email=private', doNotTrack: false };
  let ready = false;
  const transport: UmamiTrack = (transform) => events.push(transform({ website: 'test-website', url: '/unfiltered' }));
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } };
  const dependencies = { page: () => page, transport: () => ready ? transport : undefined, storage: () => storage };
  const client = createUmamiClient(dependencies);
  const config = { enabled: true, administrator: false, impersonating: false, experiment: { enabled: true, variant: 'A' as const } };
  client.configure(config);
  return { client, config, events, page, dependencies, stored, setReady: () => { ready = true; }, makeReady: () => { ready = true; client.flush(); } };
}

test('readiness retains one initial pageview and exposure, then flushes without duplicates', () => {
  const f = fixture();
  f.client.pageview();
  f.client.pageview();
  f.client.experiment('exposed', 'A');
  f.client.experiment('exposed', 'A');
  assert.equal(f.events.length, 0);
  f.makeReady();
  f.client.flush();
  f.client.pageview();
  f.client.experiment('exposed', 'A');
  assert.equal(f.events.length, 2);
  assert.equal(f.events[0].url, '/');
  assert.equal(f.events[1].name, 'landing_headline_v1_a_exposed');
  assert.equal(f.events[1].referrer, 'https://example.com');
});

test('first PDF and signup require exposure and are deduplicated across client remounts', () => {
  const f = fixture();
  f.makeReady();
  f.client.conversion('cv_downloaded');
  f.client.conversion('signup_completed');
  assert.equal(f.events.filter((event) => String(event.name).startsWith('landing_')).length, 0);
  f.client.experiment('exposed');
  f.client.conversion('cv_downloaded');
  f.client.conversion('cv_downloaded');
  f.client.conversion('signup_completed');
  const remounted = createUmamiClient(f.dependencies);
  remounted.configure(f.config);
  remounted.experiment('exposed');
  remounted.conversion('cv_downloaded');
  remounted.conversion('signup_completed');
  assert.deepEqual(f.events.filter((event) => String(event.name).startsWith('landing_')).map((event) => event.name), [
    'landing_headline_v1_a_exposed', 'landing_headline_v1_a_first_pdf', 'landing_headline_v1_a_signup',
  ]);
});

test('a deferred exposure survives a full page navigation before the SDK loads and attributes one first PDF', () => {
  const f = fixture();
  f.client.pageview();
  f.client.experiment('exposed');
  f.client.experiment('cta');
  const queueKey = 'matchply:landing_headline_v1:pending';
  assert.deepEqual(JSON.parse(f.stored.get(queueKey)!), [
    { variant: 'A', stage: 'exposed', pathname: '/' },
    { variant: 'A', stage: 'cta', pathname: '/' },
  ]);
  assert.doesNotMatch(f.stored.get(queueKey)!, /title|referrer|website|email|private|pageview/);

  f.page.pathname = '/editor/private-cv-id';
  f.page.title = 'CV de una persona privada';
  const editor = createUmamiClient(f.dependencies);
  editor.configure(f.config);
  editor.conversion('cv_downloaded');
  const reload = createUmamiClient(f.dependencies);
  reload.configure(f.config);
  reload.conversion('cv_downloaded');
  assert.equal(f.events.length, 0);
  assert.doesNotMatch(f.stored.get(queueKey)!, /private-cv-id|privada|referrer/);
  f.setReady();
  reload.flush();
  editor.flush();
  f.client.flush();
  for (let index = 0; index < 3; index += 1) {
    const remounted = createUmamiClient(f.dependencies);
    remounted.configure(f.config);
    remounted.experiment('exposed');
    remounted.conversion('cv_downloaded');
    remounted.flush();
  }
  assert.deepEqual(f.events.filter((event) => String(event.name).startsWith('landing_')).map((event) => event.name), [
    'landing_headline_v1_a_exposed', 'landing_headline_v1_a_cta', 'landing_headline_v1_a_first_pdf',
  ]);
  assert.equal(f.events.find((event) => event.name === 'landing_headline_v1_a_exposed')?.url, '/');
  assert.equal(f.events.find((event) => event.name === 'landing_headline_v1_a_first_pdf')?.url, '/editor/:cvId');
  assert.deepEqual(JSON.parse(f.stored.get(queueKey)!), []);
});

test('a persisted queue is discarded when collection, the experiment or an existing exclusion is disabled', () => {
  const queueKey = 'matchply:landing_headline_v1:pending';
  for (const exclusion of ['disabled', 'experiment', 'variant', 'dnt', 'admin', 'impersonation', 'admin-route', 'api-route'] as const) {
    const f = fixture();
    f.client.experiment('exposed');
    f.client.conversion('cv_downloaded');
    const next: UmamiClientConfig = { ...f.config, experiment: { ...f.config.experiment } };
    if (exclusion === 'disabled') next.enabled = false;
    if (exclusion === 'experiment') next.experiment.enabled = false;
    if (exclusion === 'variant') next.experiment.variant = 'B';
    if (exclusion === 'dnt') f.page.doNotTrack = true;
    if (exclusion === 'admin') next.administrator = true;
    if (exclusion === 'impersonation') next.impersonating = true;
    if (exclusion === 'admin-route') f.page.pathname = '/admin/users';
    if (exclusion === 'api-route') f.page.pathname = '/api/guest';
    const remounted = createUmamiClient(f.dependencies);
    remounted.configure(next);
    assert.deepEqual(JSON.parse(f.stored.get(queueKey)!), [], exclusion);
    f.setReady();
    remounted.flush();
    assert.equal(f.events.length, 0, exclusion);
  }
});

test('an excluded visitor creates no deferred measurement storage, and a newly blocked action aborts its existing queue', () => {
  const f = fixture();
  const queueKey = 'matchply:landing_headline_v1:pending';
  const excluded = createUmamiClient(f.dependencies);
  excluded.configure({ ...f.config, enabled: false });
  assert.equal(excluded.experiment('exposed'), false);
  assert.equal(f.stored.has(queueKey), false);
  f.client.experiment('exposed');
  f.page.doNotTrack = true;
  assert.equal(f.client.conversion('cv_downloaded'), false);
  assert.deepEqual(JSON.parse(f.stored.get(queueKey)!), []);
  f.page.doNotTrack = false;
  const remounted = createUmamiClient(f.dependencies);
  remounted.configure(f.config);
  f.setReady();
  remounted.conversion('cv_downloaded');
  assert.equal(f.events.filter((event) => String(event.name).startsWith('landing_')).length, 0);
});

test('SDK readiness before configuration neither erases a previous page queue nor bypasses tracking controls', () => {
  const f = fixture();
  const queueKey = 'matchply:landing_headline_v1:pending';
  f.client.experiment('exposed');
  const before = f.stored.get(queueKey);
  const remounted = createUmamiClient(f.dependencies);
  f.setReady();
  remounted.flush();
  remounted.pageview();
  assert.equal(remounted.conversion('cv_downloaded'), false);
  remounted.setExperiment(f.config.experiment);
  assert.equal(f.stored.get(queueKey), before);
  assert.equal(f.events.length, 0);
  remounted.configure(f.config);
  remounted.conversion('cv_downloaded');
  assert.deepEqual(f.events.filter((event) => String(event.name).startsWith('landing_')).map((event) => event.name), [
    'landing_headline_v1_a_exposed', 'landing_headline_v1_a_first_pdf',
  ]);
});

test('rehydration rejects unsafe or malformed queue fields and conversions without a queued or sent exposure', () => {
  const f = fixture();
  const queueKey = 'matchply:landing_headline_v1:pending';
  f.stored.set(queueKey, JSON.stringify([
    { variant: 'A', stage: 'first_pdf', pathname: '/editor/:cvId' },
    { variant: 'B', stage: 'exposed', pathname: '/' },
    { variant: 'A', stage: 'exposed', pathname: '/editor/private-cv-id' },
    { variant: 'A', stage: 'exposed', pathname: '/?email=private@example.com' },
    { variant: 'A', stage: 'private-event', pathname: '/' },
  ]));
  const remounted = createUmamiClient(f.dependencies);
  remounted.configure(f.config);
  assert.deepEqual(JSON.parse(f.stored.get(queueKey)!), []);
  f.setReady();
  remounted.flush();
  remounted.conversion('cv_downloaded');
  assert.equal(f.events.filter((event) => String(event.name).startsWith('landing_')).length, 0);
  for (const value of ['{', '{}', 'x'.repeat(4097)]) {
    f.stored.set(queueKey, value);
    const invalid = createUmamiClient(f.dependencies);
    assert.doesNotThrow(() => invalid.configure(f.config));
    assert.deepEqual(JSON.parse(f.stored.get(queueKey)!), []);
  }
});

test('a first landing visit through client navigation updates the persistent experiment context', () => {
  const f = fixture();
  f.makeReady();
  f.client.configure({ ...f.config, experiment: { enabled: false, variant: null } });
  assert.equal(f.client.experiment('exposed'), false);
  f.client.setExperiment({ enabled: true, variant: 'B' });
  f.client.experiment('exposed', 'B');
  f.page.pathname = '/try';
  f.client.pageview();
  f.client.conversion('cv_downloaded');
  assert.deepEqual(f.events.filter((event) => String(event.name).startsWith('landing_')).map((event) => event.name), [
    'landing_headline_v1_b_exposed', 'landing_headline_v1_b_first_pdf',
  ]);
});

test('the guest redirect, registration server action and editor reload retain one attributed funnel', async (t) => {
  productionTracking(t);
  const initialResponse = await middleware(request());
  const assignment = initialResponse.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME)!.value;
  const cookie = `${LANDING_EXPERIMENT_COOKIE_NAME}=${assignment}`;
  const experiment = resolveLandingExperiment({ enabled: true, cookieValue: assignment });
  const f = fixture();
  f.client.configure({ ...f.config, experiment });
  f.makeReady();
  f.client.experiment('exposed', experiment.variant!);

  f.page.pathname = '/try';
  const guestResponse = await middleware(request({ cookie }, '/try'));
  assert.equal(guestResponse.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
  const afterGuestRedirect = createUmamiClient(f.dependencies);
  afterGuestRedirect.configure({ ...f.config, experiment });

  f.page.pathname = '/register';
  const actionResponse = await middleware(new NextRequest('https://matchply.example/register', {
    method: 'POST', headers: { cookie: `${cookie}; matchply_guest=opaque`, 'next-action': 'registration-action' },
  }));
  assert.equal(actionResponse.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME), undefined);
  const afterAction = resolveLandingExperiment({
    enabled: true,
    headerValue: actionResponse.headers.get(`x-middleware-request-${LANDING_EXPERIMENT_HEADER_NAME}`),
    cookieValue: assignment,
  });
  assert.deepEqual(afterAction, experiment);
  afterGuestRedirect.configure({ ...f.config, experiment: afterAction });
  afterGuestRedirect.conversion('signup_completed');

  f.page.pathname = '/editor/private-cv-id';
  const afterClaim = createUmamiClient(f.dependencies);
  afterClaim.configure({ ...f.config, experiment });
  afterClaim.conversion('cv_downloaded');
  afterClaim.conversion('cv_downloaded');
  const prefix = `landing_headline_v1_${experiment.variant!.toLowerCase()}`;
  assert.deepEqual(f.events.filter((event) => String(event.name).startsWith('landing_')).map((event) => event.name), [
    `${prefix}_exposed`, `${prefix}_signup`, `${prefix}_first_pdf`,
  ]);
  assert.equal(f.events.find((event) => event.name === `${prefix}_first_pdf`)?.url, '/editor/:cvId');
});

test('a failed deferred exposure cannot create a first PDF without its denominator', () => {
  const f = fixture();
  let ready = false;
  const events: UmamiPayload[] = [];
  const client = createUmamiClient({
    ...f.dependencies,
    transport: () => ready ? (transform) => {
      const event = transform({});
      if (event.name === 'landing_headline_v1_a_exposed') throw new Error('Blocked');
      events.push(event);
    } : undefined,
  });
  client.configure(f.config);
  client.experiment('exposed');
  client.conversion('cv_downloaded');
  ready = true;
  client.flush();
  assert.deepEqual(events.map((event) => event.name), ['cv_downloaded']);
});

test('all queued and immediate events respect DNT, admin, impersonation and disallowed routes', () => {
  for (const exclusion of ['disabled', 'dnt', 'admin', 'impersonation', 'admin-route', 'api-route'] as const) {
    const f = fixture();
    f.client.experiment('exposed');
    const next = { ...f.config };
    if (exclusion === 'disabled') next.enabled = false;
    if (exclusion === 'dnt') f.page.doNotTrack = true;
    if (exclusion === 'admin') next.administrator = true;
    if (exclusion === 'impersonation') next.impersonating = true;
    if (exclusion === 'admin-route') f.page.pathname = '/admin/users';
    if (exclusion === 'api-route') f.page.pathname = '/api/guest';
    f.client.configure(next);
    f.makeReady();
    assert.equal(f.client.conversion('cv_downloaded'), false);
    assert.equal(f.client.experiment('cta'), false);
    assert.equal(f.events.length, 0, exclusion);
  }
});

test('conversion payloads omit private titles, paths and SDK identity and tracking failure does not fail the product action', () => {
  const f = fixture();
  f.makeReady();
  f.page.pathname = '/editor/11111111-2222-4333-a444-555555555555';
  f.page.title = 'CV de Ana García — Directora de Acme';
  f.client.conversion('cv_downloaded');
  assert.equal(f.events[0].url, '/editor/:cvId');
  assert.equal(f.events[0].title, 'Matchply | Editor');
  assert.doesNotMatch(JSON.stringify(f.events), /11111111|private|email=|Ana|García|Acme/);
  const sanitized: UmamiPayload[] = [];
  const identityClient = createUmamiClient({
    ...f.dependencies,
    transport: () => (transform) => sanitized.push(transform({ website: 'test-website', id: 'private-person-id', data: { email: 'private@example.com' }, tag: 'private-person-name' })),
  });
  identityClient.configure(f.config);
  identityClient.conversion('cv_downloaded');
  assert.doesNotMatch(JSON.stringify(sanitized), /private-person|private@example/);
  const client = createUmamiClient({ ...f.dependencies, transport: () => () => { throw new Error('Script blocked'); } });
  client.configure(f.config);
  assert.doesNotThrow(() => client.conversion('signup_completed'));
});
