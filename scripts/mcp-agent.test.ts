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

test('a missing API token message does not include a token', () => {
  const result = requireMatchplyToken({} as NodeJS.ProcessEnv);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.message.includes('mp_live_'), false);
    assert.match(result.message, /MATCHPLY_API_TOKEN/);
  }
});
