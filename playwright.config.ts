import { defineConfig } from '@playwright/test';
const baseURL = process.env.INTEGRATION_TEST_APP_URL || 'http://127.0.0.1:3100';
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) throw new Error('Browser tests require an isolated local app');
export default defineConfig({
  testDir: './e2e', workers: 1, fullyParallel: false, timeout: 60_000,
  outputDir: process.env.PERF_OUTPUT_DIR || 'test-results',
  expect: { timeout: 15_000 },
  use: { baseURL, browserName: 'chromium', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  reporter: [['list'], ['json', { outputFile: `${process.env.PERF_OUTPUT_DIR || 'test-results'}/results.json` }]],
  projects: [
    { name: 'regression', testMatch: /regression\.spec\.ts/ },
    { name: 'performance', testMatch: /performance\.spec\.ts/ },
  ],
});
