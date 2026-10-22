import { test, expect } from '@playwright/test';
import { login, profiles, routes } from './support';

test('record production navigation timings and resource bytes', async ({ browser }, testInfo) => {
  test.setTimeout(2 * 60 * 60_000);
  const samples = Number(process.env.PERF_SAMPLES || 30);
  const origin = process.env.INTEGRATION_TEST_APP_URL || 'http://127.0.0.1:3100';
  const data: unknown[] = [];
  const budgets = new Map<string, { count: number; started: number }>();
  let rateLimited = 0;
  for (const profile of profiles) for (const mobile of [false, true]) {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
    await login(context, profile);
    const page = await context.newPage(); const cdp = await context.newCDPSession(page);
    const budget = budgets.get(profile) || { count: 0, started: Date.now() };
    budgets.set(profile, budget);
    page.on('request', request => { if (/\/api\/pdf(?:\?|$)/.test(request.url())) budget.count++; });
    page.on('response', response => { if (response.status() === 429) rateLimited++; });
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: mobile ? 150 : 20, downloadThroughput: (mobile ? 10 : 50) * 1024 * 1024 / 8, uploadThroughput: 10 * 1024 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: mobile ? 4 : 1 });
    for (const route of routes(profile)) for (const cold of [true, false]) {
      const timings: number[] = []; let bytes = 0, js = 0;
      for (let sample = 0; sample < samples; sample++) {
        // Keep the product's real PDF rate limit enabled, including cold thumbnail loads.
        if (budget.count >= 35) {
          await new Promise(resolve => setTimeout(resolve, Math.max(0, 61_000 - (Date.now() - budget.started))));
          budget.count = 0; budget.started = Date.now();
        }
        if (cold) await cdp.send('Network.clearBrowserCache');
        const response = await page.goto(route); expect(response?.status()).toBe(200);
        const useful = route.startsWith('/editor/') ? page.locator('[contenteditable="true"]:visible').first()
          : route.includes('/applications') ? page.getByText(/^Perf (role|contact|small company|medium company|large company) \d+$/).filter({ visible: true }).first()
          : route === '/dashboard' ? page.getByText(/^Perf CV \d+$/).filter({ visible: true }).first() : page.locator('main input:visible').first();
        await expect(useful).toBeVisible();
        const metrics = await page.evaluate(() => {
          const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
          return { time: performance.now(), bytes: nav.transferSize + resources.reduce((sum, entry) => sum + entry.transferSize, 0), js: resources.filter(entry => /\.js(?:\?|$)/.test(entry.name)).reduce((sum, entry) => sum + entry.transferSize, 0) };
        });
        timings.push(metrics.time); bytes += metrics.bytes; js += metrics.js;
      }
      timings.sort((a,b) => a-b);
      data.push({ kind: 'document', profile, mobile, cold, route, samples, p50Ms: timings[Math.floor(samples * .5)], p95Ms: timings[Math.min(samples - 1, Math.ceil(samples * .95) - 1)], meanBytes: bytes / samples, meanJsBytes: js / samples });
      console.log(JSON.stringify({ profile, mobile, cold, route, samples, p50Ms: timings[Math.floor(samples * .5)] }));
    }
    if (!mobile) {
      await page.goto('/dashboard/applications');
      for (const route of ['/dashboard', '/dashboard/applications']) {
        const times: number[] = []; let rscBytes = 0;
        for (let i = 0; i < samples; i++) {
          if (i > 0) {
            const other = route === '/dashboard' ? '/dashboard/applications' : '/dashboard';
            await page.locator(`a[href="${other}"]:visible`).first().click();
            await expect(page).toHaveURL(new URL(other, origin).href);
          }
          const start = await page.evaluate(() => ({ time: performance.now(), resources: performance.getEntriesByType('resource').length }));
          await page.locator(`a[href="${route}"]:visible`).first().click();
          await expect(page).toHaveURL(new URL(route, origin).href);
          await expect(page.getByText(route === '/dashboard' ? /^Perf CV \d+$/ : /^Perf role \d+$/).filter({ visible:true }).first()).toBeVisible();
          const result = await page.evaluate(start => ({ time: performance.now() - start.time, rsc: (performance.getEntriesByType('resource').slice(start.resources) as PerformanceResourceTiming[]).filter(entry => entry.name.includes('_rsc=')).reduce((sum,entry)=>sum+entry.transferSize,0) }), start);
          expect(result.time).toBeGreaterThanOrEqual(0); times.push(result.time); rscBytes += result.rsc;
        }
        times.sort((a,b)=>a-b);
        data.push({ kind:'clientNavigation', profile, mobile:false, cold:false, route, samples, p50Ms:times[Math.floor(samples*.5)], p95Ms:times[Math.min(samples-1,Math.ceil(samples*.95)-1)], meanRscBytes:rscBytes/samples });
      }
    }
    await context.close();
  }
  expect(rateLimited).toBe(0);
  await testInfo.attach('navigation-metrics', { body: JSON.stringify({
    date: new Date().toISOString(), browser: browser.version(), runnerNode: process.version,
    build: process.env.PERF_BUILD || 'unspecified', serverRuntime: process.env.PERF_SERVER_RUNTIME || 'unspecified',
    desktop: { viewport:[1440,1000], latencyMs:20, downloadMiBits:50, cpuRate:1 },
    mobile: { viewport:[390,844], latencyMs:150, downloadMiBits:10, cpuRate:4 },
    data,
  }, null, 2), contentType: 'application/json' });
});
