import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentApiError } from '@/lib/agent-api/errors';
import { publicErrorCode } from '@/lib/agent-api/http';
import { parseAgentStatus, parseCrmEntity, parseIdBatch, parseStatusBatchBody, parseViewName } from '@/lib/agent-api/validate';
import { normalizeViewConfig } from '@/lib/application-views';

const MATCHING_HOY = {
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
};

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

test('Matching Hoy normalizes to the captured board view', () => {
  const config = normalizeViewConfig(MATCHING_HOY);
  assert.deepEqual(config.columns, ['score', 'title', 'company', 'status', 'createdAt', 'updatedAt']);
  assert.equal(config.filters.status, 'interested');
  assert.equal(config.filters.date, 'custom');
  assert.equal(config.filters.startDate, '2026-10-31');
  assert.equal(config.filters.endDate, '2026-10-31');
  assert.deepEqual(config.filters.columnFilters, [{ column: 'platform', operator: 'equals', value: 'linkedin' }]);
  assert.deepEqual(config.sort, { key: 'updatedAt', direction: 'desc' });
  assert.equal(config.pageSize, 25);
  assert.equal(config.actionsIndex, null);
});

test('view names collapse spaces and stay within 60 characters', () => {
  assert.throws(() => parseViewName('   '), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_name');
  assert.throws(() => parseViewName(12), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_name');
  assert.equal(parseViewName('  Matching   Hoy  '), 'Matching Hoy');
  assert.equal(parseViewName(`  ${'a'.repeat(80)}  `), 'a'.repeat(60));
});

test('view entity is one of the three CRM tables', () => {
  assert.equal(parseCrmEntity('applications'), 'applications');
  assert.equal(parseCrmEntity('companies'), 'companies');
  assert.equal(parseCrmEntity('people'), 'people');
  assert.throws(() => parseCrmEntity('jobs'), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_entity');
  assert.equal(publicErrorCode('invalid_entity'), 'validation');
  assert.equal(publicErrorCode('invalid_view'), 'validation');
  assert.equal(publicErrorCode('invalid_ids'), 'validation');
  assert.equal(publicErrorCode('invalid_page'), 'validation');
});

test('application status batches accept 1 to 200 distinct ids', () => {
  assert.throws(() => parseIdBatch([]), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_ids');
  assert.throws(() => parseIdBatch(Array.from({ length: 201 }, (_, index) => uuid(index + 1))), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_ids');
  assert.throws(() => parseIdBatch([uuid(1), uuid(1)]), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_ids');
  assert.throws(() => parseIdBatch(['not-a-uuid']), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_ids');
  const ids = Array.from({ length: 200 }, (_, index) => uuid(index + 1));
  assert.deepEqual(parseIdBatch(ids), ids);
  assert.throws(() => parseAgentStatus('archived:ghost'), (error: unknown) => error instanceof AgentApiError);
  assert.throws(() => parseStatusBatchBody({ ids: [uuid(1)], status: 'archived:ghost' }), (error: unknown) => error instanceof AgentApiError && error.code === 'invalid_status');
  assert.deepEqual(parseStatusBatchBody({ ids, status: 'applied' }), { ids, status: 'applied' });
});
