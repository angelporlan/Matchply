import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('profile sections support keyboard tabs, retain drafts and show optional-safe progress', async ({ page, context }) => {
  const database = process.env.INTEGRATION_TEST_DATABASE_URL;
  if (!database || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(database).hostname) || !new URL(database).pathname.includes('test')) throw new Error('Profile browser fixture requires an isolated local test database');
  const { Client } = await import('pg');
  const { default: bcrypt } = await import('bcryptjs');
  const client = new Client({ connectionString: database });
  await client.connect();
  const userId = randomUUID(), email = `profile-browser-${userId}@example.test`, password = randomUUID();
  const profile = { masterDocument: 'Trayectoria profesional en atención al paciente, formación sanitaria y prácticas supervisadas en un hospital.', skills: [{ name: 'Atención al paciente', category: 'other', proficiency: 'used', evidence: 'Prácticas supervisadas' }] };
  try {
    await client.query('insert into "user" (id, email, "passwordHash", "careerProfile") values ($1, $2, $3, $4)', [userId, email, bcrypt.hashSync(password, 4), profile]);
    const csrf = await (await context.request.get('/api/auth/csrf')).json();
    await context.request.post('/api/auth/callback/credentials', { form: { csrfToken: csrf.csrfToken, email, password, callbackUrl: '/dashboard' } });
    const session = await (await context.request.get('/api/auth/session')).json();
    expect(session?.user?.id).toBe(userId);
    await page.goto('/dashboard/profile');
    const tabs = page.getByRole('tablist', { name: 'Secciones del perfil', exact: true });
    const yourProfile = tabs.getByRole('tab', { name: 'Tu perfil', exact: true });
    const criteria = tabs.getByRole('tab', { name: 'Qué busco', exact: true });
    await expect(page.getByRole('progressbar', { name: 'Completitud del perfil' })).toHaveAttribute('value', '2');
    await yourProfile.focus(); await page.keyboard.press('ArrowRight');
    await expect(criteria).toBeFocused(); await expect(criteria).toHaveAttribute('aria-selected', 'true');
    await page.locator('#career-criteria').fill('Busco un equipo con aprendizaje compartido.');
    await page.keyboard.press('Shift+Tab');
    await yourProfile.click();
    await expect(page.locator('#career-panel-criteria')).toBeHidden();
    await yourProfile.focus(); await page.keyboard.press('End');
    await expect(page.locator('#career-criteria')).toHaveValue('Busco un equipo con aprendizaje compartido.');
    await criteria.focus(); await page.keyboard.press('Home');
    await expect(yourProfile).toBeFocused();
    await expect(page.getByRole('progressbar', { name: 'Completitud del perfil' })).toHaveAttribute('value', '2');
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally { await client.query('delete from "user" where id=$1', [userId]); await client.end(); }
});
