import './full-flow-check';
import { test, expect } from '@playwright/test';
import { fixtureId, login, profiles, routes } from './support';

async function captureFunnel(page: import('@playwright/test').Page) {
  const events: Array<{ name?: string; data?: Record<string, unknown>; url?: string }> = [];
  await page.exposeFunction('captureSyntheticFunnel', (event: typeof events[number]) => { events.push(event); });
  await page.addInitScript(() => {
    Object.assign(window, { umami: { track: (transform: (base: Record<string, unknown>) => unknown) => {
      const capture = (window as unknown as { captureSyntheticFunnel: (event: unknown) => void }).captureSyntheticFunnel;
      capture(transform({ website: '11111111-2222-4333-a444-555555555555', hostname: '127.0.0.1' }));
    } } });
  });
  await page.route('**/__analytics-test.js', route => route.fulfill({ contentType: 'application/javascript', body: '/* isolated synthetic analytics */' }));
  return events;
}

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

for (const width of [1440, 390]) test(`entry title and date stay in separate columns at ${width}px`, async ({ page, context }) => {
  await login(context);
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/editor/${fixtureId('medium:cv:1')}`);
  await page.getByTitle('Ver editor Markdown', { exact: true }).click();
  const textarea = page.locator('textarea').first();
  const original = await textarea.inputValue();
  const content = `# Synthetic Candidate\n\n## Formación\n\n### Técnico superior en instalaciones electrotécnicas de media y baja tensión\nCentro de Formación | 2020 - 2024, prácticas profesionales y programa de formación complementaria`;
  const save = async (value: string) => {
    const saved = page.waitForResponse((response) => response.request().method() === 'POST' && Boolean(response.request().headers()['next-action']));
    await textarea.fill(value);
    expect((await saved).status()).toBe(200);
    await expect(page.getByText(/Guardado en la nube|Saved to cloud/).first()).toBeVisible();
  };

  try {
    await save(content);
    await page.getByTitle('Volver al diseño del documento', { exact: true }).click();
    const row = page.locator('.cv-head');
    await expect(row).toHaveCount(1);
    const geometry = await row.evaluate((element) => {
      const title = element.children[0].getBoundingClientRect();
      const date = element.children[1].getBoundingClientRect();
      const company = element.parentElement?.querySelector('[data-flow="company-0-0"]')?.getBoundingClientRect();
      const bounds = element.getBoundingClientRect();
      return {
        titleRight: title.right,
        titleBottom: title.bottom,
        dateLeft: date.left,
        dateRight: date.right,
        dateBottom: date.bottom,
        rowBottom: bounds.bottom,
        companyTop: company?.top ?? null,
      };
    });
    expect(geometry.titleRight).toBeLessThanOrEqual(geometry.dateLeft);
    expect(geometry.dateRight).toBeLessThanOrEqual(await row.evaluate((element) => element.getBoundingClientRect().right));
    expect(geometry.titleBottom).toBeLessThanOrEqual(geometry.rowBottom);
    expect(geometry.dateBottom).toBeLessThanOrEqual(geometry.rowBottom);
    expect(geometry.companyTop).not.toBeNull();
    expect(geometry.companyTop!).toBeGreaterThanOrEqual(geometry.rowBottom);
    await page.screenshot({ path: test.info().outputPath('entry-header-columns.png') });
  } finally {
    const markdownToggle = page.getByTitle('Ver editor Markdown', { exact: true });
    if (await markdownToggle.isVisible()) await markdownToggle.click();
    const source = page.locator('textarea').first();
    if (await source.isVisible()) await save(original);
  }
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

for (const width of [1440, 390]) test(`optimization retry recovers the same admitted job at ${width}px`, async ({ page, context }) => {
  const analytics = await captureFunnel(page);
  await login(context);
  await page.setViewportSize({ width, height: 900 });
  const cvId = fixtureId('medium:cv:1');
  let recovered = false, polls = 0, admissions = 0;
  const content = '# Performance Candidate\n\n## Perfil Profesional\nRecovered after interruption.';
  await page.addInitScript(({ cvId }) => {
    sessionStorage.setItem('matchply_optimize_params', JSON.stringify({
      baseCvId: cvId, resultCvId: cvId, jobId: 'recovery-job', requestId: 'recovery-request-one',
      jobDescription: 'Pasted offer for Python APIs', resumeMode: 'optimize_adapted',
    }));
  }, { cvId });
  await page.route('**/api/ai/optimize', async route => { admissions++; await route.abort(); });
  await page.route('**/api/ai/jobs/recovery-job', async route => {
    polls++;
    if (!recovered) { await route.abort('failed'); return; }
    await route.fulfill({ json: { status: 'completed', result: { stage: 'completed', optimizationId: 'recovery-optimization', variants: [] } } });
  });
  await page.route(`**/api/cv/${cvId}/optimization`, route => route.fulfill({ json: { optimization: {
    id: 'recovery-optimization', sourceMarkdown: content, analysis: null,
    variants: [{ modeId: 'optimize_adapted', status: 'ready', content, error: null, revision: 0 }],
  } } }));
  await page.goto(`/editor/${cvId}?optimize=true`);
  const retry = page.getByRole('button', { name: 'Reintentar', exact: true });
  await expect(retry).toBeVisible();
  expect(polls).toBe(3);
  await expect(page.getByText('ID: recovery-request-one')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('matchply_optimize_params')!).jobDescription)).toBe('Pasted offer for Python APIs');
  recovered = true;
  await retry.click();
  await expect(retry).toBeHidden();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('matchply_optimize_params'))).toBeNull();
  expect(admissions).toBe(0);
  expect(polls).toBe(4);
  await expect.poll(() => analytics.filter(event => event.name === 'cv_optimized').length).toBe(1);
  expect(analytics.filter(event => event.name === 'cv_optimization_started')).toHaveLength(1);
  expect(analytics).toContainEqual(expect.objectContaining({ name: 'cv_optimization_failed', data: { mode: 'optimize_adapted', error_code: 'OPTIMIZATION_CONNECTION_LOST' } }));
});

for (const blocked of [false, true]) for (const guest of [true, false]) for (const width of [1440, 390]) test(`${blocked ? 'blocked portal to pasted offer' : 'pasted offer without URL'}: ${guest ? 'guest' : 'registered'} at ${width}px`, async ({ page, context }) => {
  const analytics = await captureFunnel(page);
  await page.setViewportSize({ width, height: 900 });
  if (!guest) await login(context);
  const content = '# QA Candidate\n\n## Perfil Profesional\nDesarrollo APIs con Python y pruebas automatizadas.';
  const description = 'Buscamos una desarrolladora Python para crear APIs con pruebas automatizadas. Trabajo en equipo y experiencia con bases de datos.';
  let admission: { baseCvId: string; jobDescription: string; url: string; requestId: string } | null = null;
  let imports = 0;
  await page.route('**/api/ai/offers/import', async route => {
    imports++;
    if (blocked) await route.fulfill({ status: 202, json: { jobId: 'blocked-import-job' } });
    else await route.abort();
  });
  await page.route('**/api/ai/jobs/blocked-import-job', route => route.fulfill({ json: {
    status: 'failed', result: null, lastError: 'No se pudo completar la acción con IA. Inténtalo de nuevo.', errorCode: 'OFFER_PORTAL_BLOCKED',
  } }));
  await page.route('**/api/ai/optimize', async route => {
    admission = route.request().postDataJSON();
    await route.fulfill({ status: 202, json: { jobId: 'pasted-offer-job', cvId: admission!.baseCvId, requestId: admission!.requestId } });
  });
  await page.route('**/api/ai/jobs/pasted-offer-job', route => route.fulfill({ json: {
    status: 'completed', result: { stage: 'completed', optimizationId: 'pasted-offer-optimization', variants: [] },
  } }));
  await page.route('**/api/cv/*/optimization', route => route.fulfill({ json: { optimization: {
    id: 'pasted-offer-optimization', sourceMarkdown: content, analysis: null,
    variants: [{ modeId: 'optimize_adapted', status: 'ready', content, revision: 0, error: null }],
  } } }));
  if (guest) {
    await page.goto('/try');
    await page.getByRole('button', { name: '¿No tienes PDF? Pega el texto', exact: true }).click();
    await page.getByRole('textbox', { name: 'Tu CV', exact: true }).fill(content);
    await page.getByRole('button', { name: 'Continuar al paso 2 (añadir oferta)', exact: true }).click();
  } else {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Generar con IA', exact: true }).click();
  }
  const hasDraft = !blocked || !guest || width === 390;
  if (hasDraft) await page.getByRole('button', { name: 'Pegar descripción manualmente', exact: true }).click();
  const textarea = page.getByRole('textbox', { name: 'Descripción y requisitos', exact: true });
  if (hasDraft) await textarea.fill(description);
  const link = page.getByRole('textbox', { name: 'Enlace a la oferta', exact: true });
  if (blocked) {
    await link.fill('https://jobs.hiringroom.com/jobs/example');
    await page.getByRole('button', { name: 'Importar oferta', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'No hemos podido leer este enlace.' })).toContainText('No hemos podido leer este enlace. Pega aquí la descripción de la oferta.');
    await expect(textarea).toHaveValue(hasDraft ? description : '');
    await expect(textarea).toBeFocused();
    await expect(link).toHaveValue('https://jobs.hiringroom.com/jobs/example');
    if (!hasDraft) await textarea.fill(description);
    if (guest && width === 390) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath('blocked-offer-mobile.png'), fullPage: true });
      await page.getByText('Cómo importar según el portal', { exact: true }).click();
      await expect(page.getByText(/HiringRoom y otros portales/)).toBeVisible();
      await page.getByRole('button', { name: 'Cómo instalar y usar la extensión de LinkedIn', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: 'Cerrar guía', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }
  } else await expect(link).toHaveValue('');
  const submit = page.getByRole('button', { name: guest ? 'Adaptar mi CV' : 'Iniciar Optimización por IA', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => admission?.jobDescription).toBe(description);
  expect(admission!.url).toBe(blocked ? 'https://jobs.hiringroom.com/jobs/example' : '');
  expect(imports).toBe(blocked ? 1 : 0);
  await expect(page).toHaveURL(/\/editor\//);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('matchply_optimize_params'))).toBeNull();
  await expect.poll(() => analytics.filter(event => event.name === 'cv_optimized').length).toBe(1);
  expect(analytics.filter(event => event.name === 'cv_optimization_started')).toHaveLength(1);
  expect(analytics.some(event => event.name === 'offer_pasted' && event.data?.method === 'paste')).toBe(true);
  expect(analytics.some(event => event.name === 'offer_imported')).toBe(false);
  if (blocked) expect(analytics).toContainEqual(expect.objectContaining({ name: 'offer_import_failed', data: { method: 'url', domain: 'jobs.hiringroom.com', error_code: 'OFFER_PORTAL_BLOCKED' } }));
  if (guest) {
    expect(analytics.some(event => event.name === 'trial_started')).toBe(true);
    expect(analytics.some(event => event.name === 'cv_imported' && event.data?.method === 'text')).toBe(true);
  }
  expect(JSON.stringify(analytics)).not.toMatch(/QA Candidate|Desarrollo APIs|Buscamos una|jobs\/example|baseCvId|jobDescription|requestId/);
});

for (const width of [390, 1440]) test(`cold anonymous trial entry hydrates cleanly at ${width}px`, async ({ page, context, baseURL }) => {
  const database = process.env.INTEGRATION_TEST_DATABASE_URL;
  if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('An isolated test database is required');
  const { createHash } = await import('node:crypto');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: database }); await client.connect();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  try {
    await page.route('**/__analytics-test.js', route => route.fulfill({ contentType: 'application/javascript', body: '/* synthetic analytics */' }));
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/try');
    const paste = page.getByRole('button', { name: '¿No tienes PDF? Pega el texto', exact: true });
    await expect(paste).toBeEnabled(); await paste.click();
    await expect(page.getByRole('textbox', { name: 'Tu CV', exact: true })).toBeVisible();
    expect(errors.filter(error => /hydration|Minified React error #4/i.test(error))).toEqual([]);
  } finally {
    const cookie = (await context.cookies(baseURL)).find(item => item.name === 'matchply_guest');
    if (cookie) await client.query('delete from "user" where "guestTokenHash"=$1', [createHash('sha256').update(cookie.value).digest('hex')]);
    await client.end();
  }
});

test('guest text entry waits for JavaScript readiness instead of losing an early click', async ({ page, context }) => {
  await context.request.get('/api/guest?redirect=/try');
  let release!: () => void;
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/chunks/app/try/page*.js', async route => {
    await scriptsReady; await route.continue();
  });
  try {
    await page.goto('/try', { waitUntil: 'commit' });
    const paste = page.getByRole('button', { name: '¿No tienes PDF? Pega el texto', exact: true });
    await expect(paste).toBeDisabled();
    release();
    await expect(paste).toBeEnabled();
    await paste.click();
    await expect(page.getByRole('textbox', { name: 'Tu CV', exact: true })).toBeVisible();
  } finally { release(); }
});

test('editor disables adaptation during save preflight and admits a double submission once', async ({ page, context }) => {
  await login(context, 'small');
  const cvId = fixtureId('small:cv:0');
  await page.goto(`/editor/${cvId}`);
  await page.getByTitle('Ver editor Markdown', { exact: true }).click();
  const source = page.locator('textarea').first();
  const original = await source.inputValue();
  let releaseSave!: () => void, held = false, admissions = 0;
  const saved = new Promise<void>(resolve => { releaseSave = resolve; });
  await page.route(`**/editor/${cvId}`, async route => {
    if (!held && route.request().method() === 'POST' && route.request().headers()['next-action']) {
      held = true;
      const response = await route.fetch();
      await saved;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.route('**/api/ai/optimize', async route => {
    admissions++;
    await route.fulfill({ status: 400, json: { error: 'Prueba de admisión terminada sin generar un CV.' } });
  });
  try {
    await source.fill(`${original}\n\nSynthetic pending save.`);
    await expect.poll(() => held).toBe(true);
    const description = page.getByRole('textbox', { name: 'Descripción / Requisitos de la Oferta *', exact: true });
    await description.fill('Buscamos experiencia en Python y APIs con pruebas automatizadas y trabajo en equipo.');
    const submit = page.getByRole('button', { name: 'Adaptar a esta oferta', exact: true });
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Foto en el CV', exact: true })).toBeDisabled();
    await description.evaluate(element => element.closest('form')!.requestSubmit());
    releaseSave();
    await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
    expect(admissions).toBe(1);
  } finally {
    releaseSave();
    await source.fill(original);
    await expect(page.getByText(/Guardado en la nube|Saved to cloud/).first()).toBeVisible();
  }
});

test('a failed PDF download shows a safe retry action and a later attempt succeeds', async ({ page, context }) => {
  const analytics = await captureFunnel(page);
  await login(context, 'large');
  await page.goto(`/editor/${fixtureId('large:cv:0')}`);
  let attempts = 0;
  await page.route(/\/api\/pdf\?.*download=true/, async route => {
    if (++attempts === 1) await route.fulfill({ status: 500, json: { code: 'private_provider_error', error: 'RAW_PROVIDER_RESPONSE SELECT sk-client-canary' } });
    else await route.continue();
  });
  const button = page.getByRole('link', { name: 'Descargar PDF', exact: true });
  await button.click();
  const error = page.getByRole('alert').filter({ hasText: 'No se pudo descargar el PDF.' });
  await expect(error).toContainText('vuelve a pulsar Descargar PDF');
  await expect(page.locator('body')).not.toContainText('sk-client-canary');
  await expect(page.locator('body')).not.toContainText('RAW_PROVIDER_RESPONSE');
  expect(analytics.some(event => event.name === 'cv_downloaded')).toBe(false);
  const download = page.waitForEvent('download');
  await button.click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/i);
  await expect(error).toBeHidden();
  expect(attempts).toBe(2);
  await expect.poll(() => analytics.filter(event => event.name === 'cv_downloaded').length).toBe(1);
});

test('landing and successful URL import emit safe funnel events with the actual method', async ({ page }) => {
  const analytics = await captureFunnel(page);
  await page.goto('/');
  await expect.poll(() => analytics.filter(event => event.name === 'landing_viewed').length).toBe(1);
  await page.goto('/try');
  await page.getByRole('button', { name: '¿No tienes PDF? Pega el texto', exact: true }).click();
  await page.getByRole('textbox', { name: 'Tu CV', exact: true }).fill('# Synthetic candidate\n\nAPI development with Python and automated tests.');
  await page.getByRole('button', { name: 'Continuar al paso 2 (añadir oferta)', exact: true }).click();
  await page.route('**/api/ai/offers/import', route => route.fulfill({ status: 202, json: { jobId: 'funnel-url-job' } }));
  await page.route('**/api/ai/jobs/funnel-url-job', route => route.fulfill({ json: { status: 'completed', result: {
    jobTitle: 'Synthetic role', company: 'Synthetic company', platform: 'linkedin', url: 'https://www.linkedin.com/jobs/view/123?token=private-canary',
    jobDescription: 'Buscamos una desarrolladora de APIs con Python y pruebas automatizadas, experiencia en bases de datos y colaboración en equipo.', sources: [],
  } } }));
  await page.getByRole('textbox', { name: 'Enlace a la oferta', exact: true }).fill('https://www.linkedin.com/jobs/view/123?token=private-canary');
  await page.getByRole('button', { name: 'Importar oferta', exact: true }).click();
  await expect.poll(() => analytics.filter(event => event.name === 'offer_imported').length).toBe(1);
  expect(analytics).toContainEqual(expect.objectContaining({ name: 'offer_imported', data: { method: 'url', domain: 'linkedin.com' } }));
  expect(analytics.some(event => event.name === 'offer_pasted')).toBe(false);
  expect(JSON.stringify(analytics)).not.toMatch(/private-canary|Synthetic candidate|Synthetic role|Synthetic company|jobs\/view/);
});

test('browser diagnostics correlate API errors without leaking bodies or recursively reporting collector failures', async ({ page, context }) => {
  const reports: Array<Record<string, unknown>> = [];
  let requestId = '';
  // Initialize the guest via HTTP so this test isolates API failures from React's recoverable initial redirect.
  await context.request.get('/api/guest?redirect=/try');
  await page.route('**/__analytics-test.js', route => route.fulfill({ contentType: 'application/javascript', body: '/* isolated synthetic analytics */' }));
  await page.route('**/api/diagnostics/errors', async route => {
    reports.push(route.request().postDataJSON());
    await route.fulfill({ status: 503 });
  });
  await page.route('**/api/cv/parse-pdf', async route => {
    requestId = route.request().headers()['x-request-id'];
    await route.fulfill({ status: 500, headers: { 'x-request-id': requestId }, json: { code: 'PDF_PARSE_FAILED', error: 'PRIVATE_SQL_CANARY SELECT sk-private' } });
  });
  await page.goto('/try');
  await expect(page.getByRole('button', { name: '¿No tienes PDF? Pega el texto', exact: true })).toBeEnabled();
  const received = await page.evaluate(async () => (await fetch('/api/cv/parse-pdf', { method: 'POST' })).json());
  expect(received.error).toContain('PRIVATE_SQL_CANARY'); // The observer must not consume or rewrite the caller response.
  await expect.poll(() => reports).toEqual([expect.objectContaining({ requestId, code: 'PDF_PARSE_FAILED', step: 'cv-import', route: '/try' })]);
  await page.evaluate(() => {
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('PRIVATE_BROWSER_STACK'), message: 'PRIVATE_BROWSER_STACK' }));
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('PRIVATE_BROWSER_STACK'), message: 'PRIVATE_BROWSER_STACK' }));
  });
  await expect.poll(() => reports.length).toBe(2);
  expect(reports[1]).toMatchObject({ requestId, code: 'UNEXPECTED_ERROR', step: 'page' });
  expect(JSON.stringify(reports)).not.toMatch(/PRIVATE_|SELECT|sk-private|stack|message/);
  await page.getByRole('button', { name: '¿No tienes PDF? Pega el texto', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Tu CV', exact: true })).toBeEditable();
  expect(reports).toHaveLength(2);
});

test('administrator can find error references and explicit reports on desktop and mobile', async ({ page, context, baseURL }) => {
  const database = process.env.INTEGRATION_TEST_DATABASE_URL;
  if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('Admin browser fixture requires an isolated local test database');
  const { randomUUID } = await import('node:crypto');
  const { default: pg } = await import('pg');
  const { default: bcrypt } = await import('bcryptjs');
  const client = new pg.Client({ connectionString: database }); await client.connect();
  const userId = randomUUID(), requestId = randomUUID(), reportId = randomUUID(), email = `diagnostics-browser-${userId}@example.test`, password = randomUUID();
  const comment = '<img src=x onerror=alert(1)> El archivo no se abrió.';
  try {
    await client.query('insert into "user" (id, email, "passwordHash", role) values ($1, $2, $3, $4)', [userId, email, bcrypt.hashSync(password, 4), 'admin']);
    await client.query('insert into operational_error ("requestId", event, code, route, source) values ($1, $2, $3, $4, $5)', [requestId, 'browser_optimization_failed', 'NETWORK_ERROR', '/editor/:cvId', 'browser']);
    await client.query('insert into problem_report (id, \"requestId\", step, route, comment) values ($1,$2,$3,$4,$5)', [reportId, requestId, 'cv-import', '/try', comment]);
    const csrf = await (await context.request.get(`${baseURL}/api/auth/csrf`)).json();
    await context.request.post(`${baseURL}/api/auth/callback/credentials`, { form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${baseURL}/dashboard` } });
    expect((await (await context.request.get(`${baseURL}/api/auth/session`)).json()).user.id).toBe(userId);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/admin/errors?requestId=${requestId}`);
      await expect(page.getByRole('heading', { name: 'Errores operativos', exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: /requestId:/ })).toContainText(requestId);
      await expect(page.getByRole('cell', { name: /NETWORK_ERROR/ })).toContainText('Comprueba tu conexión');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`error-index-${width}.png`), fullPage: true });
      await page.goto(`/admin/reports?requestId=${requestId}`);
      await expect(page.getByRole('heading', { name: 'Avisos de usuarios', exact: true })).toBeVisible();
      await expect(page.getByRole('article')).toContainText(comment);
      await expect(page.getByRole('article').locator('img')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`report-inbox-${width}.png`), fullPage: true });
      await page.getByRole('link', { name: 'Buscar errores relacionados', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Errores operativos', exact: true })).toBeVisible();
    }
  } finally {
    await client.query('delete from problem_report where id = $1', [reportId]);
    await client.query('delete from operational_error where "requestId" = $1', [requestId]);
    await client.query('delete from "user" where id = $1', [userId]); await client.end();
  }
});

for (const guest of [true, false]) for (const width of [1440, 390]) test(`another offer preserves the original base: ${guest ? 'guest' : 'registered'} at ${width}px`, async ({ page, context, baseURL }) => {
  const database = process.env.INTEGRATION_TEST_DATABASE_URL;
  if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('Repeat-offer fixture requires an isolated local test database');
  const { randomUUID, createHash } = await import('node:crypto');
  const { default: pg } = await import('pg');
  const { default: bcrypt } = await import('bcryptjs');
  const client = new pg.Client({ connectionString: database }); await client.connect();
  const userId = randomUUID(), baseId = randomUUID(), adaptedId = randomUUID(), optimizationId = randomUUID();
  const password = randomUUID(), email = `repeat-${userId}@example.test`, token = randomUUID();
  const original = '# Original candidate\n\n## Perfil Profesional\nPython APIs, SQL and automated testing.';
  const tailored = original + '\n\nOnly for the first offer.';
  const description = 'Buscamos una desarrolladora Python para construir APIs con pruebas automatizadas y bases de datos SQL, trabajando en equipo.';
  const admissions: Array<{ baseCvId: string; jobDescription: string; requestId: string; url: string }> = [];
  try {
    await client.query('insert into "user" (id, email, "passwordHash", "subscriptionStatus", "isGuest", "guestTokenHash", "guestExpiresAt") values ($1, $2, $3, $4, $5, $6, $7)', [userId, email, bcrypt.hashSync(password, 4), guest ? 'none' : 'active', guest, guest ? createHash('sha256').update(token).digest('hex') : null, guest ? new Date(Date.now() + 86400_000) : null]);
    await client.query('insert into cv (id, "userId", title, content, "isBase", "isPrincipal") values ($1,$2,$3,$4,true,true), ($5,$2,$6,$7,false,false)', [baseId, userId, 'Original base', original, adaptedId, 'First tailored CV', tailored]);
    await client.query('insert into cv_optimization (id, "userId", "cvId", "sourceCvId", "sourceMarkdown", "sourceProfile", offer, "promptVersion", "resolvedAiConfig", "subscriptionStatus", "operationId") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [optimizationId, userId, adaptedId, baseId, original, '', JSON.stringify({}), 'synthetic', JSON.stringify({}), 'none', randomUUID()]);
    await client.query('update cv set "optimizationId"=$1, "activeOptimizeMode"=$2 where id=$3', [optimizationId, 'optimize_adapted', adaptedId]);
    await client.query('insert into cv_variant ("optimizationId", "modeId", content, status) values ($1,$2,$3,$4)', [optimizationId, 'optimize_adapted', tailored, 'ready']);
    if (guest) await context.addCookies([{ name: 'matchply_guest', value: token, url: baseURL! }]);
    else {
      const csrf = await (await context.request.get('/api/auth/csrf')).json();
      await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: `${baseURL}/dashboard` } });
      expect((await (await context.request.get('/api/auth/session')).json()).user.id).toBe(userId);
    }
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/ai/offers/import', route => route.fulfill({ status: 202, json: { jobId: 'repeat-import' } }));
    await page.route('**/api/ai/jobs/repeat-import', route => route.fulfill({ json: { status: 'completed', result: { jobTitle: 'Second role', company: 'Second company', jobDescription: description, platform: 'other', url: 'https://example.test/jobs/second', sources: [], sourceMethod: 'direct' } } }));
    await page.route('**/api/ai/optimize', async route => {
      admissions.push(route.request().postDataJSON());
      await route.fulfill({ status: 202, json: { jobId: 'repeat-optimize', cvId: adaptedId, requestId: admissions.at(-1)!.requestId } });
    });
    await page.route('**/api/ai/jobs/repeat-optimize', route => route.fulfill({ json: { status: 'completed', result: { stage: 'completed', optimizationId, variants: [] } } }));
    await page.goto(`/editor/${adaptedId}`);
    const repeat = page.getByRole('button', { name: 'Adaptar a otra oferta', exact: true });
    await expect(repeat).toBeVisible(); await expect(repeat).toBeEnabled();
    await repeat.click();
    const dialog = page.getByRole('dialog', { name: 'Adaptar a otra oferta', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Enlace a la oferta', exact: true }).fill('https://example.test/jobs/second');
    await dialog.getByRole('button', { name: 'Importar oferta', exact: true }).click();
    await expect(dialog.getByText('Second role', { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`repeat-offer-${guest}-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Adaptar a esta oferta', exact: true }).dblclick();
    await expect.poll(() => admissions.length).toBe(1);
    expect(admissions[0]).toMatchObject({ baseCvId: baseId, jobDescription: description, url: 'https://example.test/jobs/second' });
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('matchply_optimize_params'))).toBeNull();
    await expect(repeat).toBeEnabled(); await repeat.click();
    await dialog.getByRole('button', { name: 'Pegar descripción manualmente', exact: true }).click();
    const paste = dialog.getByRole('textbox', { name: 'Descripción y requisitos', exact: true });
    await paste.fill(description + ' Otra oferta distinta.');
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
    await expect(repeat).toBeFocused(); await repeat.click();
    await expect(paste).toHaveValue(description + ' Otra oferta distinta.');
    await dialog.getByRole('button', { name: 'Adaptar a esta oferta', exact: true }).click();
    await expect.poll(() => admissions.length).toBe(2);
    expect(admissions[1].baseCvId).toBe(baseId);
    expect(admissions[1].requestId).not.toBe(admissions[0].requestId);
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('matchply_optimize_params'))).toBeNull();
    expect((await client.query('select content from cv where id=$1', [baseId])).rows[0].content).toBe(original);
    expect((await client.query('select content from cv where id=$1', [adaptedId])).rows[0].content).toBe(tailored);
  } finally { await client.query('delete from "user" where id=$1', [userId]); await client.end(); }
});

for (const guest of [true, false]) for (const width of [1440, 390]) test(`explicit problem report retries safely: ${guest ? 'guest' : 'registered'} at ${width}px`, async ({ page, context }) => {
  const database = process.env.INTEGRATION_TEST_DATABASE_URL;
  if (!database || !['localhost','127.0.0.1','[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('Reports require an isolated local test database');
  const { randomUUID } = await import('node:crypto'); const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: database }); await client.connect();
  let requestId = randomUUID();
  const comment = 'El control dejó de responder después de añadir el archivo.';
  const diagnosticIds: string[] = [];
  const submissions: Array<{ id:string;requestId:string;step:string;route:string;comment:string }> = [];
  let fail = true;
  try {
    if (guest) await context.request.get('/api/guest?redirect=/try'); else await login(context,'small');
    await page.setExtraHTTPHeaders({ 'x-real-ip': `reports-browser-${requestId}` });
    await page.setViewportSize({ width, height:900 });
    await page.route('**/api/diagnostics/errors', route => { diagnosticIds.push(route.request().postDataJSON().requestId); return route.fulfill({status:202,json:{accepted:true}}); });
    await page.route('**/api/cv/parse-pdf', route => route.fulfill({status:500,headers:{'x-request-id':requestId},json:{code:'PDF_PARSE_FAILED',error:'PRIVATE_EXCEPTION_CANARY'}}));
    await page.route('**/api/diagnostics/reports', async route => {
      submissions.push(route.request().postDataJSON());
      if(fail) await route.fulfill({status:503,json:{error:'PRIVATE_REPORT_ERROR'}}); else await route.continue();
    });
    const path = guest ? '/try' : `/editor/${fixtureId('small:cv:0')}`;
    await page.goto(path);
    await page.evaluate(async () => { await fetch('/api/cv/parse-pdf',{method:'POST'}); });
    // Successful background requests must not replace the reference to the failed operation.
    await page.route('**/api/pdf', route => route.fulfill({status:200,headers:{'x-request-id':'unrelated-success-request'},body:'synthetic'}));
    await page.evaluate(async () => { await fetch('/api/pdf',{method:'POST'}); });
    const trigger = page.getByRole('button',{name:'¿Algo falló?',exact:true}); await expect(trigger).toBeVisible(); await trigger.click();
    const dialog = page.getByRole('dialog',{name:'¿Algo falló?',exact:true});
    await expect(dialog).toContainText(requestId);
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    requestId = randomUUID();
    await page.evaluate(async () => { await fetch('/api/cv/parse-pdf',{method:'POST'}); });
    await expect.poll(() => diagnosticIds).toContain(requestId);
    await trigger.click(); await expect(dialog).toContainText(requestId);
    await expect(dialog.getByRole('combobox',{name:'Paso en el que ocurrió',exact:true})).toHaveValue('cv-import');
    const text = dialog.getByRole('textbox',{name:'¿Qué pasó? (opcional)',exact:true}); await text.fill(comment);
    await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused(); await trigger.click();
    await expect(text).toHaveValue(comment);
    await page.screenshot({path:test.info().outputPath(`problem-report-${guest}-${width}.png`),fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await dialog.getByRole('button',{name:'Enviar aviso',exact:true}).dblclick();
    await expect(dialog.getByRole('alert')).toContainText('Conservamos tu borrador');
    expect(submissions).toHaveLength(1); await expect(text).toHaveValue(comment);
    expect(await page.locator('body').innerText()).not.toMatch(/PRIVATE_REPORT_ERROR|PRIVATE_EXCEPTION_CANARY/);
    fail=false; await dialog.getByRole('button',{name:'Enviar aviso',exact:true}).click();
    await expect(dialog.getByRole('status')).toContainText('Aviso recibido');
    expect(submissions).toHaveLength(2); expect(submissions[1]).toEqual(submissions[0]);
    expect(submissions[0]).toMatchObject({requestId,step:'cv-import',route:guest?'/try':'/editor/:cvId',comment});
    const records = await client.query('select * from problem_report where id=$1',[submissions[0].id]);
    expect(records.rows).toHaveLength(1); expect(records.rows[0].comment).toBe(comment); expect(records.rows[0].requestId).toBe(requestId);
    await dialog.getByRole('button',{name:'Cerrar',exact:true}).click();
    // English entry and keyboard focus remain available in the same app location.
    await context.addCookies([{name:'lang',value:'en',url:process.env.INTEGRATION_TEST_APP_URL || 'http://127.0.0.1:3100'}]);
    await page.reload(); await page.getByRole('button',{name:'Did something go wrong?',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Did something go wrong?',exact:true})).toContainText('Your comment is optional');
  } finally {
    for (const id of Array.from(new Set(submissions.map(value=>value.id)))) await client.query('delete from problem_report where id=$1',[id]);
    await client.end();
  }
});
