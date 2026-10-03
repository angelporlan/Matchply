import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCrmConfig, defaultCrmConfig, normalizeEntityConfig, systemCrmViews } from '@/lib/crm-views';
import { DEFAULT_VIEW_CONFIG, SYSTEM_VIEWS, normalizeViewConfig, viewConfigsEqual } from '@/lib/application-views';

test('entity views retain column order and isolate catalogs', () => {
  const company = normalizeCrmConfig('companies', { columns: ['sector', 'name', 'status'], sort: { key: 'sector', direction: 'asc' }, columnWidths: { sector: 'lg', actions: 'sm' }, actionsIndex: 0 });
  assert.deepEqual(company.columns, ['sector', 'name']);
  assert.equal(company.actionsIndex, 0);
  assert.equal(company.columnWidths.sector, 'lg');
  assert.deepEqual(normalizeCrmConfig('people', { columns: ['sector'] }).columns, defaultCrmConfig('people').columns);
  assert.deepEqual(normalizeEntityConfig('applications', DEFAULT_VIEW_CONFIG), normalizeViewConfig(DEFAULT_VIEW_CONFIG));
});
test('unsupported operators and malformed relations cannot enter a saved query', () => {
  const config = normalizeCrmConfig('people', { filters: { columnFilters: [
    { column: 'companyNames', operator: 'in', values: ['foreign-text', '00000000-0000-0000-0000-000000000001'] },
    { column: 'status', operator: 'in', values: ['pending', 'archived'] },
    { column: 'lastContactAt', operator: 'contains', value: 'x' },
    { column: 'notes', operator: 'contains', value: 'private' },
  ] } });
  assert.equal(config.filters.columnFilters!.length, 2);
  assert.deepEqual(config.filters.columnFilters![0].values, ['00000000-0000-0000-0000-000000000001']);
  assert.deepEqual(config.filters.columnFilters![1].values, ['pending']);
});
test('date ranges and numeric count filters are validated before execution', () => {
  const config = normalizeCrmConfig('companies', { filters: { columnFilters: [
    { column: 'createdAt', operator: 'customRange', startDate: '2026-10-03', endDate: '2026-09-01' },
    { column: 'applicationCount', operator: 'gte', value: '0' },
    { column: 'noteCount', operator: 'lt', value: 'NaN' },
  ] }, pageSize: 50 });
  assert.equal(config.pageSize, 50);
  assert.deepEqual(config.filters.columnFilters, [{ column: 'applicationCount', operator: 'gte', value: '0' }]);
});
test('favorites are persistible presets and applications include archived records', () => {
  assert.equal(normalizeCrmConfig('people', { filters: { favoritesOnly: true } }).filters.favoritesOnly, true);
  assert.equal(systemCrmViews('companies').find(v => v.id === 'favorites')!.config.filters.favoritesOnly, true);
  assert.deepEqual(SYSTEM_VIEWS.find(v => v.id === 'favorites')!.config.filters.excludedStatuses, []);
});
test('dirty state compares grouping and all multiselect/range values', () => {
  const config = normalizeViewConfig({ ...DEFAULT_VIEW_CONFIG, grouping: { column: 'company', direction: 'asc' }, filters: { columnFilters: [{ column: 'company', operator: 'in', values: ['a'] }] } });
  assert.equal(viewConfigsEqual(config, normalizeViewConfig(config)), true);
  assert.equal(viewConfigsEqual(config, normalizeViewConfig({ ...config, filters: { ...config.filters, columnFilters: [{ column: 'company', operator: 'in', values: ['b'] }] } })), false);
});
