import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = process.env.AI_COST_TEST_DATABASE_URL;
test('physical AI requests persist usage and report correctly by user and function', { skip: !url }, async t => {
  const target = new URL(url!);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) && target.pathname.includes('test'), 'Use an isolated local test database');
  process.env.DATABASE_URL = url;
  const { db, pool } = await import('@/db');
  const { users, aiRequestUsage } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { withAiUsageContext } = await import('@/lib/ai-usage-context');
  const { fetchWithAiUsage } = await import('@/lib/ai-usage-fetch');
  const { flushAiRequestUsage } = await import('@/lib/ai-request-usage');
  const { loadAiUsageReport, parseUsageReportFilters } = await import('@/lib/ai-usage-report');
  const { runWithUsage, transferGuestUsage } = await import('@/lib/usage');
  const ids: string[] = [randomUUID(), randomUUID(), randomUUID()]; const fixturePrefix = `cost-${ids[0]}`;
  await db.insert(users).values(ids.map((id, index) => ({ id, name: `Cost fixture ${index}`, email: `${fixturePrefix}-${index}@example.test`, isGuest: index === 2, subscriptionStatus: index === 2 ? 'none' : 'active' })));
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async (input, init) => {
    providerCalls++;
    const body = JSON.parse(String(init?.body || '{}'));
    if (body.model === 'error-model') return new Response('failure', { status: 429 });
    if (String(input).includes('openrouter')) return Response.json({ model: body.model, usage: { prompt_tokens: 200, completion_tokens: 40, cost: 0 }, choices: [{ message: { content: 'private completion' } }] });
    return Response.json({ id: `request-${providerCalls}`, status: 'completed', answers: [],
      output: body.tools ? [{ type: 'web_search_call', action: { type: 'search' } }, { type: 'message', content: [{ text: 'private description' }] }] : [],
      usage: { input_tokens: 1000, output_tokens: String(input).endsWith('decisions') ? 0 : 200, input_tokens_details: { cached_tokens: 400 }, output_tokens_details: { reasoning_tokens: 100 } } });
  };
  const request = (endpoint: string, model = 'gpt-6-luna', tools = false) => fetchWithAiUsage(`https://api.openai.com/v1/${endpoint}`, { method: 'POST', body: JSON.stringify({ model, input: 'private candidate CV', ...(tools ? { tools: [{ type: 'web_search' }] } : {}) }) });
  try {
    await t.test('50 selected offers count 50 Decisions calls; nested description lookup counts separately', async () => {
      const jobId = randomUUID();
      await withAiUsageContext({ userId: ids[0], jobId, functionKey: 'match_batch' }, async () => {
        for (let i = 0; i < 50; i++) await (await request('decisions')).json();
        await withAiUsageContext({ functionKey: 'import_offer' }, async () => (await request('responses', 'gpt-6-luna', true)).json());
      });
      await flushAiRequestUsage();
      const report = await loadAiUsageReport(parseUsageReportFilters({ user: ids[0] }));
      assert.equal(report.totals.requests, 51); assert.equal(report.functions.length, 2);
      assert.equal(report.totals.inputTokens, 51_000); assert.equal(report.totals.outputTokens, 200);
      assert.equal(report.totals.cachedInputTokens, 20_400); assert.equal(report.totals.webSearchCalls, 1);
      assert.ok(Math.abs(report.totals.costUsd - .015164) < 1e-9);
      assert.equal(report.functions.find(f => f.functionKey === 'match_batch')?.requests, 50);
      assert.equal(report.recent.length, 25); assert.equal(report.requestCount, 51);
      const rows = await db.select().from(aiRequestUsage).where(eq(aiRequestUsage.userId, ids[0]));
      assert.ok(rows.every(row => row.jobId === jobId));
      assert.ok(!JSON.stringify(rows).includes('private'));
    });
    await t.test('zero provider cost and unavailable model prices remain distinguishable', async () => {
      await withAiUsageContext({ userId: ids[1], functionKey: 'networking' }, async () => {
        await (await fetchWithAiUsage('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'openrouter/free' }) })).json();
        await (await request('responses', 'unknown-model')).json();
        assert.equal((await request('responses', 'error-model')).status, 429);
      });
      await flushAiRequestUsage();
      const report = await loadAiUsageReport(parseUsageReportFilters({ user: ids[1] }));
      assert.equal(report.totals.requests, 3); assert.equal(report.totals.missingCost, 2); assert.equal(report.totals.failedRequests, 1);
      assert.equal(report.totals.costUsd, 0); assert.equal(report.totals.missingTokens, 1);
      assert.equal(report.recent.find(row => row.model === 'openrouter/free')?.costSource, 'reported');
      assert.equal(report.recent.find(row => row.model === 'unknown-model')?.costUsd, null);
    });
    await t.test('cached quota replay performs no extra provider request and keeps ownership', async () => {
      const input = { bucket: 'general' as const, action: 'profile:extract', requestId: randomUUID(), input: { fixture: true } };
      const call = () => runWithUsage(ids[1], input, async () => ({ ok: Boolean(await (await request('responses')).json()) }));
      const before = providerCalls; await call(); await call(); await flushAiRequestUsage();
      assert.equal(providerCalls - before, 1);
      const report = await loadAiUsageReport(parseUsageReportFilters({ user: ids[1], function: 'profile:extract' }));
      assert.equal(report.totals.requests, 1); assert.equal(report.recent[0].userId, ids[1]);
    });
    await t.test('aggregate totals agree with per-user rows, filters and page boundaries', async () => {
      const report = await loadAiUsageReport(parseUsageReportFilters({ q: fixturePrefix }));
      const fixtureRows = report.users.filter(row => ids.includes(row.userId!));
      assert.equal(fixtureRows.length, 2); assert.equal(fixtureRows.reduce((sum, row) => sum + row.requests, 0), 55);
      const first = await loadAiUsageReport(parseUsageReportFilters({ user: ids[0] }));
      const second = await loadAiUsageReport(parseUsageReportFilters({ user: ids[0], requestsPage: '2' }));
      const last = await loadAiUsageReport(parseUsageReportFilters({ user: ids[0], requestsPage: '3' }));
      assert.equal(second.recent.length, 25); assert.equal(last.recent.length, 1);
      assert.equal(new Set([...first.recent, ...second.recent, ...last.recent].map(row => row.id)).size, 51);
      assert.equal((await loadAiUsageReport(parseUsageReportFilters({ user: ids[0], function: 'networking' }))).totals.requests, 0);
    });
    await t.test('guest claim transfers token costs to the registered account', async () => {
      await withAiUsageContext({ userId: ids[2], functionKey: 'import_cv' }, async () => (await request('responses')).json());
      await flushAiRequestUsage();
      await db.transaction(tx => transferGuestUsage(tx, ids[2], ids[1]));
      assert.equal((await loadAiUsageReport(parseUsageReportFilters({ user: ids[2] }))).totals.requests, 0);
      const report = await loadAiUsageReport(parseUsageReportFilters({ user: ids[1], function: 'import_cv' }));
      assert.equal(report.totals.requests, 1);
    });
  } finally {
    globalThis.fetch = originalFetch; await flushAiRequestUsage();
    await db.delete(aiRequestUsage).where(inArray(aiRequestUsage.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
