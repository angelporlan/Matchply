// Run against two isolated production builds, never the live service.
// PERF_BASELINE_URL=http://127.0.0.1:3190 PERF_CANDIDATE_URL=http://127.0.0.1:3191
// PERF_OUTPUT=/tmp/comparison.json node scripts/performance-comparison.mjs
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const versions = ['baseline', 'candidate'];
const onlyPdf = process.env.PERF_ONLY_PDF === '1';
const origins = Object.fromEntries(versions.map(version => {
  const value = process.env[`PERF_${version.toUpperCase()}_URL`];
  if (!value || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(value).hostname)) {
    throw new Error('Both PERF URLs must point to isolated local apps');
  }
  return [version, value];
}));
const output = process.env.PERF_OUTPUT;
assert(output, 'PERF_OUTPUT is required');
const samplesPerRound = Number(process.env.PERF_SAMPLES_PER_ROUND || 15);
assert(Number.isInteger(samplesPerRound) && samplesPerRound > 0);
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values.length, p50Ms: sorted[Math.floor(sorted.length * .5)], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1] };
};
const browser = await chromium.launch();
const contexts = {};
const observations = [];
const pdfBursts = [];
let errors = 0;
try {
  for (const version of versions) {
    const context = await browser.newContext({ baseURL: origins[version], viewport: { width: 390, height: 844 } });
    contexts[version] = context;
    const csrf = await (await context.request.get('/api/auth/csrf')).json();
    await context.request.post('/api/auth/callback/credentials', { form: {
      csrfToken: csrf.csrfToken, email: onlyPdf ? 'perf-small@example.test' : 'perf-large@example.test', password: 'Performance-test-only-123', callbackUrl: '/dashboard',
    } });
    assert((await (await context.request.get('/api/auth/session')).json()).user?.id);
  }
  // Counterbalance order: AB then BA. No requests to the other build while measuring.
  for (let round = 0; !onlyPdf && round < 2; round++) {
    for (const version of round === 0 ? versions : [...versions].reverse()) {
      const page = await contexts[version].newPage();
      const cdp = await contexts[version].newCDPSession(page);
      page.on('response', response => { if (response.status() >= 400) errors++; });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 10 * 1024 * 1024 / 8, uploadThroughput: 10 * 1024 * 1024 / 8 });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const ready = () => page.getByText(/^Perf role \d+$/).filter({ visible: true }).first().waitFor({ state: 'visible' });
      await page.goto('/dashboard/applications'); await ready();
      for (const cache of ['cold', 'warm']) {
        for (let i = 0; i < samplesPerRound; i++) {
          if (cache === 'cold') await cdp.send('Network.clearBrowserCache');
          const response = await page.goto('/dashboard/applications');
          assert.equal(response.status(), 200); await ready();
          const metric = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            return { timeMs: performance.now(), transferBytes: nav.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0) };
          });
          observations.push({ version, round, cache, ...metric });
        }
        console.log(JSON.stringify({ version, round, cache, ...summary(observations.filter(row => row.version === version && row.round === round && row.cache === cache).map(row => row.timeMs)) }));
      }
      await page.close();
    }
  }
  // Each burst has a unique hash, so no previous result can satisfy it from cache.
  // Warm workers first, then 3 x 10 requests per version (below the real limit).
  const content = marker => `# Synthetic performance candidate ${marker}\n\n## Experiencia Profesional\n### Desarrollo\n**Acme** | *2022 – Presente*\n` + '- Desarrollo APIs Python con pruebas.\n'.repeat(560);
  for (const version of versions) {
    const response = await contexts[version].request.post('/api/pdf', { headers: { Origin: origins[version] }, data: { content: content(`warm-${version}-${Date.now()}`), template: 'harvard' } });
    assert.equal(response.status(), 200); await response.body();
  }
  for (let round = 0; round < 3; round++) {
   const body = content(`burst-${round}-${Date.now()}`);
   for (const version of round % 2 === 0 ? versions : [...versions].reverse()) {
    const started = performance.now();
    const rows = await Promise.all(Array.from({ length: 10 }, async () => {
      const before = performance.now();
      const response = await contexts[version].request.post('/api/pdf', { headers: { Origin: origins[version] }, data: { content: body, template: 'harvard' } });
      assert.equal(response.status(), 200);
      assert.equal(response.headers()['x-pdf-pages'], '10');
      const buffer = await response.body(); assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
      return { timeMs: performance.now() - before, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') };
    }));
    const row = { version, round, profile: onlyPdf ? 'small' : 'large', contentSha256: createHash('sha256').update(body).digest('hex'), totalMs: performance.now() - started, requests: rows };
    // Separate renders can carry different PDF metadata/IDs; the shared render must be identical.
    if (version === 'candidate') assert.equal(new Set(rows.map(row => row.sha256)).size, 1, 'Shared responses must contain identical bytes');
    pdfBursts.push(row); console.log(JSON.stringify(row));
   }
  }
  assert.equal(errors, 0, 'HTTP errors observed');
  const navigation = (onlyPdf ? [] : versions).flatMap(version => ['cold', 'warm'].map(cache => ({ version, cache, ...summary(observations.filter(row => row.version === version && row.cache === cache).map(row => row.timeMs)) })));
  await writeFile(output, JSON.stringify({ date: new Date().toISOString(), browser: browser.version(), runnerNode: process.version, serverRuntime: 'Node 20.20.2 / Next 14.2.35', onlyPdf, protocol: { route: '/dashboard/applications', profile: '5000 applications / 100 CVs', viewport: [390, 844], latencyMs: 150, downloadMiBits: 10, cpuRate: 4, order: ['AB', 'BA'], samplesPerRound, serverPrimed: true, cold: 'Browser HTTP cache cleared; server remains warm', time: 'navigation start to visible first application and observation round-trip; not LCP/INP' }, navigation, observations, pdfBursts, httpErrors: errors }, null, 2) + '\n');
} finally {
  await browser.close();
}
