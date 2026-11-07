import { test, expect } from '@playwright/test';
import { fixtureId, login } from './support';

test('CV contact form uses semantic inputs and saves custom/duplicate contacts without losing content', async ({ page, context }) => {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.INTEGRATION_TEST_DATABASE_URL });
  await client.connect();
  const cvId = fixtureId('large:cv:1');
  const previous = (await client.query('select content from cv where id=$1', [cvId])).rows[0].content;
  const markdown = '# Contact Candidate\n\n**Email:** first@example.test | **Email:** second@example.test | **GitHub:** https://github.com/synthetic\n\n## Experiencia\nContenido de experiencia conservado.';
  try {
    await client.query('update cv set content=$1 where id=$2', [markdown, cvId]);
    await login(context, 'large');
    await page.goto(`/editor/${cvId}`);
    await page.getByRole('button', { name: 'Contacto', exact: true }).click();
    const form = page.getByRole('complementary', { name: 'Revisión', exact: true });
    await expect(form.getByRole('textbox', { name: 'Email', exact: true }).first()).toHaveAttribute('type', 'email');
    await expect(form.getByRole('textbox', { name: 'Teléfono', exact: true })).toHaveAttribute('type', 'tel');
    await expect(form.getByRole('textbox', { name: 'LinkedIn', exact: true })).toHaveAttribute('inputmode', 'url');
    await form.getByRole('textbox', { name: 'Teléfono', exact: true }).fill('+34 600 000 000');
    await expect(page.getByText(/Guardado en la nube|Saved to cloud/).first()).toBeVisible();
    await form.getByRole('button', { name: 'Añadir otro dato', exact: true }).click();
    const custom = form.getByRole('textbox', { name: 'Etiqueta personalizada', exact: true }).last();
    await expect(custom).toBeFocused(); await custom.fill('Publicaciones');
    await form.getByRole('textbox', { name: 'Publicaciones', exact: true }).fill('https://example.test/papers');
    await expect.poll(async () => (await client.query('select content from cv where id=$1', [cvId])).rows[0].content).toContain('https://example.test/papers');
    await page.reload();
    await page.getByRole('button', { name: 'Contacto', exact: true }).click();
    await expect(form.getByRole('textbox', { name: 'Teléfono', exact: true })).toHaveValue('+34 600 000 000');
    await expect(form.getByRole('textbox', { name: 'GitHub', exact: true })).toHaveValue('https://github.com/synthetic');
    await expect(form.getByRole('textbox', { name: 'Email', exact: true }).last()).toHaveValue('second@example.test');
    const saved = (await client.query('select content from cv where id=$1', [cvId])).rows[0].content;
    expect(saved).toContain('Contenido de experiencia conservado.');
    expect(saved).toContain('**Publicaciones:** https://example.test/papers');
  } finally { await context.close(); await client.query('update cv set content=$1 where id=$2', [previous, cvId]); await client.end(); }
});
