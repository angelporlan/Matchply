import { test, expect } from '@playwright/test';
import { fixtureId, login, profiles, routes } from './support';

for (const profile of profiles) test(`authenticated lightweight pages: ${profile}`, async ({ page, context }) => {
  await login(context, profile);
  const hydration: string[] = [];
  page.on('console', message => { if (message.type() === 'error' && /hydrat|Minified React error #4/i.test(message.text())) hydration.push(message.text()); });
  for (const route of routes(profile)) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    expect(page.url()).not.toContain('/login');
    await expect(page.locator(route.startsWith('/editor/') ? '[contenteditable="true"]' : 'main').first()).toBeVisible();
    if (route === '/dashboard' && profile !== 'small') {
      await expect.poll(() => page.locator('main img[src^="data:image/"]').count()).toBeGreaterThanOrEqual(3);
    }
    if (!route.startsWith('/editor/')) expect(await response!.text()).not.toMatch(/HEAVY_REPORT_SENTINEL|HEAVY_DESCRIPTION_SENTINEL|## Experiencia Profesional/);
  }
  expect(hydration).toEqual([]);
});

test('disabled prompt debug does no work; usage focus coalesces and invalidations refresh', async ({ page, context }) => {
  await login(context);
  let debugRequests = 0;
  page.on('request', request => { if (request.url().includes('/api/ai/debug-prompt')) debugRequests++; });
  await page.goto('/dashboard');
  await expect.poll(async () => (await page.evaluate(() => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/api/usage')).length))).toBeGreaterThan(0);
  let calls = 0, active = 0, peak = 0;
  await page.route('**/api/usage', async route => {
    calls++; peak = Math.max(peak, ++active);
    const response = await route.fetch();
    await new Promise(resolve => setTimeout(resolve, 300));
    active--; await route.fulfill({ response });
  });
  await page.evaluate(() => { for (let i = 0; i < 8; i++) window.dispatchEvent(new Event('focus')); });
  await expect.poll(() => calls).toBe(1);
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.dispatchEvent(new Event('matchply:usage-refresh')); });
  await expect.poll(() => calls).toBe(2); await expect.poll(() => active).toBe(0);
  expect(peak).toBe(1); expect(debugRequests).toBe(0);
});

test('source edits persist across reload and comparison preserves the draft', async ({ page, context }) => {
  await login(context);
  const cvId = fixtureId('medium:cv:1');
  await page.goto(`/editor/${cvId}`);
  const source = page.getByTitle('Ver editor Markdown', { exact: true });
  await expect(source).toBeVisible(); await source.click();
  const textarea = page.locator('textarea').first(); await expect(textarea).toBeEditable();
  const original = await textarea.inputValue(); const edited = `${original}\n\nPerformance regression edit.`;
  await textarea.fill(edited);
  await expect(page.getByText(/Guardado en la nube|Saved to cloud/).first()).toBeVisible();
  await page.getByTitle('Ver comparativa de cambios', { exact: true }).click();
  await expect(page.getByText('Performance regression edit.', { exact: false }).first()).toBeVisible();
  await page.getByTitle('Ver editor Markdown', { exact: true }).click();
  await expect(page.locator('textarea').first()).toHaveValue(edited);
  await page.reload(); await page.getByTitle('Ver editor Markdown', { exact: true }).click();
  await expect(page.locator('textarea').first()).toHaveValue(edited);
  await page.locator('textarea').first().fill(original);
  await expect(page.getByText(/Guardado en la nube|Saved to cloud/).first()).toBeVisible();
});

test('one, three and ten page documents save and export without losing source text', async ({ page, context, baseURL }) => {
  await login(context);
  await page.goto(`/editor/${fixtureId('medium:cv:1')}`);
  await page.getByTitle('Ver editor Markdown', { exact: true }).click();
  const textarea = page.locator('textarea').first();
  const original = await textarea.inputValue();
  const save = async (content: string) => {
    const saved = page.waitForResponse(response => response.request().method() === 'POST' && Boolean(response.request().headers()['next-action']));
    await textarea.fill(content); expect((await saved).status()).toBe(200);
    await expect(page.getByText(/Guardado en la nube|Saved to cloud/).first()).toBeVisible();
  };
  for (const [lines, pages] of [[20,1], [120,3], [560,10]]) {
    const content = '# Performance Candidate\n\n## Experiencia Profesional\n### Desarrollo\n**Acme** | *2022 – Presente*\n' + '- Desarrollo APIs Python con pruebas.\n'.repeat(lines);
    await save(content); await expect(textarea).toHaveValue(content);
    const response = await context.request.post('/api/pdf', { headers: { Origin: baseURL! }, data: { content, template:'harvard', fontFamily:'helvetica', pageMargin:36, scale:1 } });
    expect(response.status()).toBe(200); expect(response.headers()['x-pdf-pages']).toBe(String(pages));
    expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
  }
  await save(original);
});

test('concurrent PDF previews preserve bytes, headers and per-request authorization', async ({ context, baseURL }) => {
  await login(context, 'large');
  const content = `# Concurrent performance fixture ${Date.now()}\n\n## Perfil Profesional\nDesarrollo APIs.`;
  const responses = await Promise.all(Array.from({length:10}, () => context.request.post('/api/pdf', { headers:{Origin:baseURL!}, data:{content,template:'harvard'} })));
  const first = await responses[0].body();
  for (const response of responses) {
    expect(response.status()).toBe(200); expect(response.headers()['content-type']).toContain('application/pdf');
    expect(response.headers()['x-pdf-pages']).toBe('1'); expect((await response.body()).equals(first)).toBe(true);
  }
});

test('user isolation and mobile/English/dark navigation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', locale: 'en-GB' });
  await login(context, 'small');
  const foreign = await context.request.get(`/api/pdf?cvId=${fixtureId('medium:cv:0')}`);
  expect(foreign.status()).toBe(403);
  await context.addCookies([{ name: 'lang', value: 'en', url: process.env.INTEGRATION_TEST_APP_URL || 'http://127.0.0.1:3100' }]);
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto('/dashboard/applications');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
