import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromeExtensionStoreUrl } from '../src/lib/chrome-extension-store';

test('installation only links to a real Chrome Web Store item', () => {
  const id = 'abcdefghijklmnopabcdefghijklmnop';
  for (const url of [`https://chromewebstore.google.com/detail/matchply/${id}`, `https://chromewebstore.google.com/detail/${id}`]) {
    assert.equal(chromeExtensionStoreUrl(url), url);
  }
  for (const url of [undefined, '', 'invalid', 'http://chromewebstore.google.com/detail/' + id,
    'https://chromewebstore.google.com.evil.test/detail/' + id,
    'https://chromewebstore.google.com/category/extensions', 'https://chromewebstore.google.com/detail/matchply/placeholder',
    `https://user:password@chromewebstore.google.com/detail/${id}`]) {
    assert.equal(chromeExtensionStoreUrl(url), null);
  }
});

test('store and development ZIPs contain complete, separate runtimes and no private files', () => {
  const version = JSON.parse(readFileSync('chrome-extension/manifest.json', 'utf8')).version;
  for (const dev of [false, true]) {
    execFileSync(process.execPath, ['scripts/package-chrome-extension.mjs', ...(dev ? ['--dev'] : [])]);
    const zip = `build/chrome-extension/matchply-linkedin-${version}-${dev ? 'dev' : 'store'}.zip`;
    const read = (name: string) => execFileSync('unzip', ['-p', zip, name]);
    const manifest = JSON.parse(read('manifest.json').toString());
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.host_permissions.some((host: string) => /localhost|127\.0\.0\.1/.test(host)), dev);
    assert.equal(manifest.host_permissions.includes('https://matchply.com/*'), !dev);
    const names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
    assert.equal(names.length, 13);
    assert.ok(!names.some((name) => /\.env|\.pem|\.DS_Store|README|\.svg|node_modules|^\//.test(name)));
    for (const file of ['background.js', 'popup.js']) {
      const js = read(file).toString();
      assert.ok(js.includes(`const API_BASE = "${dev ? 'http://localhost:3000' : 'https://matchply.com'}";`));
      if (!dev) assert.doesNotMatch(js, /localhost|127\.0\.0\.1/);
    }
    for (const [size, path] of Object.entries(manifest.icons)) {
      const png = read(path as string);
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), Number(size));
      assert.equal(png.readUInt32BE(20), Number(size));
    }
    for (const script of [manifest.background.service_worker, ...manifest.content_scripts.flatMap((item: { js: string[] }) => item.js), manifest.action.default_popup]) {
      assert.ok(read(script).length > 0, `${script} must be packaged`);
    }
  }
});
