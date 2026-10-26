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

for (const width of [1440, 390]) test(`optimization retry recovers the same admitted job at ${width}px`, async ({ page, context }) => {
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
});

for (const blocked of [false, true]) for (const guest of [true, false]) for (const width of [1440, 390]) test(`${blocked ? 'blocked portal to pasted offer' : 'pasted offer without URL'}: ${guest ? 'guest' : 'registered'} at ${width}px`, async ({ page, context }) => {
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
