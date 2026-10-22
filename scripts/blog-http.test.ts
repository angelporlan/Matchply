import test from 'node:test';
import assert from 'node:assert/strict';
import { blogArticles, articlePath } from '@/content/blog';

const origin = process.env.BLOG_TEST_APP_URL;
test('public blog serves eight complete SSR translations, redirects, metadata and 404s', { skip: !origin }, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin!).hostname));
  const entry = await fetch(`${origin}/blog`, { redirect: 'manual' });
  assert.equal(entry.status, 308); assert.ok(entry.headers.get('location')?.endsWith('/blog/es'));
  for (const language of ['es', 'en']) {
    const index = await fetch(`${origin}/blog/${language}`);
    assert.equal(index.status, 200);
    const html = await index.text();
    assert.equal((html.match(/<h2\b/g) || []).length, 4);
  }
  for (const article of blogArticles) {
    const page = await fetch(`${origin}${articlePath(article)}`, { headers: { Cookie: `lang=${article.language === 'es' ? 'en' : 'es'}`, 'x-matchply-blog-language': article.language === 'es' ? 'en' : 'es' } });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, new RegExp(`<html[^>]+lang="${article.language}"`));
    assert.ok(html.includes(article.sections[0].paragraphs[0]), 'article is present without JavaScript');
    assert.ok(html.includes(article.source.url));
    assert.match(html, /application\/ld\+json/);
    assert.match(html, /"@type":"BlogPosting"/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /hrefLang="es"|hreflang="es"/);
    assert.match(html, /hrefLang="en"|hreflang="en"/);
    assert.ok(html.includes('href="/try"'), 'visitor CTA does not create a guest until used');
    assert.ok(!(page.headers.get('set-cookie') || '').includes('matchply_guest'));
  }
  for (const path of ['/blog/es/unknown-slug', '/blog/fr', '/blog/en/evaluar-encaje-oferta']) assert.equal((await fetch(`${origin}${path}`)).status, 404);
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  for (const article of blogArticles) assert.ok(sitemap.includes(articlePath(article)));
  assert.doesNotMatch(sitemap, /<loc>[^<]+\/(dashboard|editor|admin)/);
});
