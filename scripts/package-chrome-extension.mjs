import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const development = process.argv.includes('--dev');
if (process.argv.slice(2).some((arg) => arg !== '--dev')) throw new Error('Usage: npm run extension:package [-- --dev]');
const target = development ? 'dev' : 'store';
const destination = resolve(root, 'build/chrome-extension', target);
const source = resolve(root, 'chrome-extension');
const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
if (development) {
  manifest.name += ' (desarrollo)';
  manifest.host_permissions = manifest.host_permissions.filter((host) => host !== 'https://matchply.com/*');
  manifest.host_permissions.push('http://localhost:3000/*');
}
const files = ['background.js', 'popup.js', 'popup.html', 'popup.css', 'people.js', 'job-list.js', 'public-description.js', 'content.js',
  ...Object.values(manifest.icons)];
await mkdir(resolve(destination, 'icons'), { recursive: true });
for (const name of files) {
  const from = resolve(source, name), to = resolve(destination, name);
  if (development && ['background.js', 'popup.js'].includes(name)) {
    const code = await readFile(from, 'utf8');
    const declaration = 'const API_BASE = "https://matchply.com";';
    if (!code.includes(declaration)) throw new Error(`Missing production API declaration: ${name}`);
    await writeFile(to, code.replace(declaration, 'const API_BASE = "http://localhost:3000";'));
  } else await copyFile(from, to);
  if (name.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', to], { encoding: 'utf8' });
    if (check.status !== 0) throw new Error(check.stderr || `Invalid JavaScript: ${name}`);
  }
}
if (!development) {
  if (manifest.host_permissions.some((host) => host.includes('localhost') || host.includes('127.0.0.1') || !host.startsWith('https://'))) {
    throw new Error('Store package must only request HTTPS production hosts');
  }
  for (const name of ['background.js', 'popup.js']) {
    const code = await readFile(resolve(destination, name), 'utf8');
    if (!code.includes('const API_BASE = "https://matchply.com";') || /localhost|127\.0\.0\.1/.test(code)) {
      throw new Error(`Store package points to a development API: ${name}`);
    }
  }
}
await writeFile(resolve(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const archive = resolve(root, 'build/chrome-extension', `matchply-linkedin-${manifest.version}-${target}.zip`);
await rm(archive, { force: true });
const result = spawnSync('zip', ['-X', '-q', archive, 'manifest.json', ...files], { cwd: destination, encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'Could not create ZIP (zip command required)');
console.log(`Extension (${target}): ${archive}\nUnpacked: ${destination}`);
