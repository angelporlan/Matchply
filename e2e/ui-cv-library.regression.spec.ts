import { test, expect } from '@playwright/test';
import { login } from './support';

test('CV library combines compact pagination, company filters and a persistent view', async ({ page, context }) => {
  await login(context, 'large');
  const response = await page.goto('/dashboard');
  expect(await response!.text()).not.toMatch(/HEAVY_REPORT_SENTINEL|HEAVY_DESCRIPTION_SENTINEL|## Experiencia Profesional/);
  await expect(page.getByRole('heading', { name: 'CV Principal Base' })).toBeVisible();
  await page.getByRole('button', { name: 'Tabla compacta', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(24);
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '25–48' })).toBeVisible();
  await page.getByLabel('Empresa', { exact: true }).selectOption({ index: 1 });
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Página anterior', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(24);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tabla compacta', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 375, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
