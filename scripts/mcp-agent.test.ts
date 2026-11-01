import test from 'node:test';
import assert from 'node:assert/strict';
import { requireMatchplyToken } from '../mcp/src/client.ts';
import { runMatchplyTool } from '../mcp/src/tools.ts';

const MATCHING_HOY = {
  entity: 'applications',
  name: 'Matching Hoy',
  config: {
    columns: ['score', 'title', 'company', 'status', 'createdAt', 'updatedAt'],
    filters: {
      status: 'interested',
      cv: 'all',
      date: 'custom',
      startDate: '2026-10-31',
      endDate: '2026-10-31',
      followup: 'all',
      excludedStatuses: [],
      columnFilters: [{ column: 'platform', operator: 'equals', value: 'linkedin' }],
    },
    sort: { key: 'updatedAt', direction: 'desc' },
    pageSize: 25,
    grouping: null,
    columnWidths: {},
    actionsIndex: null,
  },
};

function header(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;
  if (!headers) return undefined;
  if (headers instanceof Headers) return headers.get(name) ?? undefined;
  if (Array.isArray(headers)) return headers.find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  const record = headers as Record<string, string>;
  return Object.entries(record).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
}

test('create view posts the Matching Hoy body and turns 409 into a tool error', async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const result = await runMatchplyTool('matchply_create_view', MATCHING_HOY, {
    token: 'mp_live_testtoken',
    baseUrl: 'https://matchply.com',
    fetch: async (url, init) => {
      seen = { url: String(url), init: init || {} };
      return new Response(JSON.stringify({ error: { code: 'conflict', message: 'Ya existe una vista con ese nombre.' } }), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      });
    },
  });
  assert.equal(seen?.url, 'https://matchply.com/api/v1/agent/views');
  assert.equal(seen?.init.method, 'POST');
  assert.equal(header(seen?.init, 'authorization'), 'Bearer mp_live_testtoken');
  assert.deepEqual(JSON.parse(String(seen?.init.body)), MATCHING_HOY);
  assert.equal(result.isError, true);
  assert.deepEqual(JSON.parse(result.content[0].text), { code: 'conflict', message: 'Ya existe una vista con ese nombre.' });
  assert.equal(result.content[0].text.includes('mp_live_testtoken'), false);
});

test('research tools call the application research route', async () => {
  const offerId = '88d9fa60-677e-48d0-93be-5c2fdd88a468';
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    seen.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({ data: { research: null } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const options = { token: 'mp_live_testtoken', baseUrl: 'https://matchply.com', fetch: fetchImpl };
  const triggered = await runMatchplyTool('matchply_trigger_research', { id: offerId, retry: true }, options);
  const loaded = await runMatchplyTool('matchply_get_research', { id: offerId }, options);
  assert.equal(triggered.isError, undefined);
  assert.equal(loaded.isError, undefined);
  assert.equal(seen[0]?.url, `https://matchply.com/api/v1/agent/applications/${offerId}/research`);
  assert.equal(seen[0]?.init.method, 'POST');
  assert.equal(header(seen[0]?.init, 'authorization'), 'Bearer mp_live_testtoken');
  assert.deepEqual(JSON.parse(String(seen[0]?.init.body)), { retry: true });
  assert.equal(seen[1]?.url, `https://matchply.com/api/v1/agent/applications/${offerId}/research`);
  assert.equal(seen[1]?.init.method, 'GET');
  assert.equal(seen[1]?.init.body, undefined);
  assert.equal(header(seen[1]?.init, 'authorization'), 'Bearer mp_live_testtoken');
});

test('a missing API token message does not include a token', () => {
  const result = requireMatchplyToken({} as NodeJS.ProcessEnv);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message.includes('mp_live_'), false);
    assert.match(result.message, /MATCHPLY_API_TOKEN/);
  }
});
