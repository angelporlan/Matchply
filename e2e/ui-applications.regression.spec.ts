import { test, expect } from '@playwright/test';
import { login } from './support';

test('application quick filters count beyond the page and extension help stays contextual', async ({ page, context }) => {
  await login(context, 'large');
  await page.goto('/dashboard/applications?view=active');
  const filters = page.getByRole('group', { name: 'Filtros rápidos de candidaturas' });
  await expect(filters.getByRole('button', { name: 'Guardadas 4000', exact: true })).toBeVisible();
  await filters.getByRole('button', { name: /^Entrevista/ }).click();
  await expect(filters.getByRole('button', { name: /^Entrevista/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await filters.getByRole('button', { name: 'Guardadas 4000', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(25);
  const help = page.getByRole('button', { name: /instalar.*extensión/i });
  await help.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(help).toBeFocused();
});
