import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderSafeMarkdownLink } from '../src/lib/safe-html';

test('report text cannot introduce HTML', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> & \'test\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;test&#39;');
});
test('markdown links permit only safe HTTP(S) URLs', () => {
  assert.match(renderSafeMarkdownLink('link', 'https://example.com/?a=1&amp;b=2'), /^<a href="https:/);
  for (const url of ['javascript:alert(1', 'https://example.com/" onclick="alert(1', 'https://user:password@example.com/', 'https://example.com/\nfoo']) assert.equal(renderSafeMarkdownLink('link', url), 'link');
});
