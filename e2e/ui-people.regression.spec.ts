import { test, expect } from '@playwright/test';
import { fixtureId, login } from './support';

test('people roles truncate and follow-ups can be scheduled directly from the table', async ({ page, context }) => {
  const { Client } = await import('pg');
  const { randomUUID } = await import('node:crypto');
  const client = new Client({ connectionString: process.env.INTEGRATION_TEST_DATABASE_URL });
  await client.connect();
  const id = randomUUID(), name = `UI contact ${id}`, role = 'Talent Acquisition · Engineering, Product and International Recruitment '.repeat(5);
  try {
    await client.query('insert into person (id, "userId", name, role) values ($1, $2, $3, $4)', [id, fixtureId('large'), name, role]);
    await login(context, 'large');
    await page.goto('/dashboard/applications/people');
    const row = page.locator('tbody tr').filter({ hasText: name });
    const title = row.getByTitle(role, { exact: true });
    await expect(title).toBeVisible();
    expect(await title.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
    await expect(row.getByRole('button', { name: `Estado: ${name}`, exact: true })).toContainText('Primer contacto');
    await row.getByRole('button', { name: `Seguimiento en 7 días: ${name}`, exact: true }).click();
    await expect(row.getByRole('link', { name: `Editar seguimiento: ${name}`, exact: true })).toBeVisible();
    expect(page.url()).toMatch(/\/people$/);
    const saved = await client.query('select "nextFollowupAt", role from person where id=$1', [id]);
    expect(saved.rows[0].nextFollowupAt).not.toBeNull(); expect(saved.rows[0].role).toBe(role);
    await row.getByRole('link', { name: 'Registrar contacto', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Conversaciones', exact: true })).toHaveAttribute('aria-selected', 'true');
  } finally { await client.query('delete from person where id=$1', [id]); await client.end(); }
});
