import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'database';
if (!['database', 'migration', 'http', 'single-connection'].includes(mode)) throw new Error('Unknown integration profile');
const database = process.env.INTEGRATION_TEST_DATABASE_URL;
if (!database) throw new Error('INTEGRATION_TEST_DATABASE_URL is mandatory; integration tests may not silently skip');
const target = new URL(database);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) || !target.pathname.includes('test')) throw new Error('An isolated local test database is required');
const env = { ...process.env, DATABASE_URL: database };
if (mode === 'single-connection') env.DATABASE_POOL_MAX = '1';
if (mode === 'http') {
  const origin = process.env.INTEGRATION_TEST_APP_URL;
  if (!origin || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) throw new Error('INTEGRATION_TEST_APP_URL must point at the local test app');
}
const files = readdirSync('scripts').filter(file => file.endsWith('.test.ts')).filter(file => {
  const source = readFileSync(`scripts/${file}`, 'utf8');
  const isMigration = file === 'discovery-quota-migration.integration.test.ts';
  const isHttp = file.endsWith('-http.test.ts');
  for (const [, key] of source.matchAll(/process\.env\.([A-Z_]+_TEST_DATABASE_URL)/g)) env[key] = database;
  if (isHttp) for (const [, key] of source.matchAll(/process\.env\.([A-Z_]+_TEST_APP_URL)/g)) env[key] = process.env.INTEGRATION_TEST_APP_URL;
  return mode === 'single-connection' ? file === 'cv-optimization.integration.test.ts'
    : mode === 'migration' ? isMigration : mode === 'http' ? isHttp : !isMigration && !isHttp && source.includes('_TEST_DATABASE_URL');
});
if (!files.length) throw new Error('No integration tests found');
const result = spawnSync(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', '--test-reporter=tap', ...files.map(file => `scripts/${file}`)], { env, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const skipped = [...result.stdout.matchAll(/^# skipped (\d+)\s*$/gm)].at(-1);
if (!skipped || Number(skipped[1]) !== 0) throw new Error('Required integration tests were skipped');
