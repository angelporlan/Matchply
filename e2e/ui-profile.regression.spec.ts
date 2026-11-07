import { test, expect } from '@playwright/test';
import { fixtureId, login } from './support';

test('profile sections support keyboard tabs, retain drafts and show optional-safe progress', async ({ page, context }) => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.INTEGRATION_TEST_DATABASE_URL });
  await client.connect();
  const userId = fixtureId('large');
  const previous = (await client.query('select "careerProfile" from "user" where id=$1', [userId])).rows[0].careerProfile;
  const profile = { masterDocument: 'Trayectoria profesional en atención al paciente, formación sanitaria y prácticas supervisadas en un hospital.', skills: [{ name: 'Atención al paciente', category: 'other', proficiency: 'used', evidence: 'Prácticas supervisadas' }] };
  try {
    await client.query('update "user" set "careerProfile"=$1 where id=$2', [profile, userId]);
    await login(context, 'large');
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
  } finally { await client.query('update "user" set "careerProfile"=$1 where id=$2', [previous, userId]); await client.end(); }
});
