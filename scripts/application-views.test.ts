import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApplicationSummary } from '@/lib/job-offer-queries';
import {
  DEFAULT_VIEW_CONFIG,
  filterApplications,
  formatApplicationTimestamp,
  groupApplications,
  normalizeViewConfig,
  paginate,
  scoreToPercent,
  sortApplications,
} from '@/lib/application-views';

const now = new Date('2026-09-12T12:00:00.000Z');

function offer(overrides: Partial<ApplicationSummary> = {}): ApplicationSummary {
  return {
    id: overrides.id || `offer-${Math.random().toString(36).slice(2)}`,
    userId: 'user-1',
    cvId: null,
    title: 'Frontend Engineer',
    company: 'Acme',
    companyId: null,
    url: null,
    platform: 'linkedin',
    status: 'interested',
    scoreOverall: null,
    tldr: null,
    legitimacyTier: null,
    livenessStatus: 'active',
    nextFollowupDate: null,
    source: null,
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-02T10:00:00.000Z'),
    ...overrides,
  };
}

test('normalizeViewConfig keeps valid values and repairs invalid ones', () => {
  const config = normalizeViewConfig({
    columns: ['title', 'title', 'nope', 'score'],
    filters: { status: 'interview', cv: 'linked', date: '7days', followup: 'overdue', search: 'react' },
    sort: { key: 'made-up', direction: 'asc' },
    pageSize: 999,
  });
  assert.deepEqual(config.columns, ['title', 'score']);
  assert.equal(config.filters.status, 'interview');
  assert.equal(config.filters.cv, 'linked');
  assert.equal(config.filters.date, '7days');
  assert.equal(config.filters.followup, 'overdue');
  assert.equal(config.filters.search, 'react');
  assert.equal(config.sort.key, DEFAULT_VIEW_CONFIG.sort.key);
  assert.equal(config.sort.direction, 'asc');
  assert.equal(config.pageSize, DEFAULT_VIEW_CONFIG.pageSize);
});

test('normalizeViewConfig falls back to defaults for empty input', () => {
  const config = normalizeViewConfig(null);
  assert.deepEqual(config.columns, DEFAULT_VIEW_CONFIG.columns);
  assert.equal(config.filters.status, 'all');
  assert.equal(config.sort.key, 'updatedAt');
  assert.equal(config.pageSize, 25);
});

test('filterApplications searches title, company, platform and summary', () => {
  const offers = [
    offer({ id: 'a', title: 'React Developer', company: 'Acme' }),
    offer({ id: 'b', title: 'Backend', company: 'Globex', tldr: 'Kubernetes y Go' }),
  ];
  assert.equal(filterApplications(offers, { search: 'react' }).length, 1);
  assert.equal(filterApplications(offers, { search: 'globex' }).length, 1);
  assert.equal(filterApplications(offers, { search: 'kubernetes' }).length, 1);
  assert.equal(filterApplications(offers, { search: 'nothing' }).length, 0);
});

test('filterApplications applies status, cv and followup filters', () => {
  const offers = [
    offer({ id: 'a', status: 'interested', cvId: 'cv-1' }),
    offer({ id: 'b', status: 'applied', cvId: null }),
    offer({ id: 'c', status: 'applied', cvId: 'cv-2', nextFollowupDate: new Date('2026-09-10T00:00:00.000Z') }),
  ];
  assert.deepEqual(filterApplications(offers, { status: 'applied' }).map(o => o.id), ['b', 'c']);
  assert.deepEqual(filterApplications(offers, { cv: 'linked' }).map(o => o.id), ['a', 'c']);
  assert.deepEqual(filterApplications(offers, { cv: 'unlinked' }).map(o => o.id), ['b']);
  assert.deepEqual(filterApplications(offers, { followup: 'withDate' }, now).map(o => o.id), ['c']);
  assert.deepEqual(filterApplications(offers, { followup: 'overdue' }, now).map(o => o.id), ['c']);
});

test('filterApplications respects date filters using local midnight', () => {
  const offers = [
    offer({ id: 'today', createdAt: new Date('2026-09-12T08:00:00.000Z') }),
    offer({ id: 'old', createdAt: new Date('2026-08-01T08:00:00.000Z') }),
  ];
  assert.deepEqual(filterApplications(offers, { date: 'today' }, now).map(o => o.id), ['today']);
  assert.deepEqual(filterApplications(offers, { date: '7days' }, now).map(o => o.id), ['today']);
  assert.deepEqual(
    filterApplications(offers, { date: 'custom', startDate: '2026-07-01', endDate: '2026-08-15' }, now).map(o => o.id),
    ['old'],
  );
});

test('sortApplications sorts dates, scores and text with stable fallback', () => {
  const offers = [
    offer({ id: 'b', updatedAt: new Date('2026-09-02T00:00:00.000Z') }),
    offer({ id: 'a', updatedAt: new Date('2026-09-05T00:00:00.000Z') }),
    offer({ id: 'c', updatedAt: new Date('2026-09-05T00:00:00.000Z') }),
  ];
  assert.deepEqual(
    sortApplications(offers, { key: 'updatedAt', direction: 'desc' }).map(o => o.id),
    ['a', 'c', 'b'],
  );

  const scored = [offer({ id: 'low', scoreOverall: 40 }), offer({ id: 'high', scoreOverall: 88 }), offer({ id: 'none' })];
  assert.deepEqual(
    sortApplications(scored, { key: 'score', direction: 'desc' }).map(o => o.id),
    ['high', 'low', 'none'],
  );

  const named = [offer({ id: 'z', title: 'Zeta' }), offer({ id: 'n', title: 'Alfa' })];
  assert.deepEqual(
    sortApplications(named, { key: 'title', direction: 'asc' }).map(o => o.id),
    ['n', 'z'],
  );
});

test('paginate clamps page and returns boundaries', () => {
  const items = Array.from({ length: 23 }, (_, index) => index);
  const first = paginate(items, 1, 10);
  assert.deepEqual(first.items, items.slice(0, 10));
  assert.equal(first.totalPages, 3);
  assert.equal(first.start, 0);
  assert.equal(first.end, 10);

  const last = paginate(items, 99, 10);
  assert.deepEqual(last.items, items.slice(20));
  assert.equal(last.page, 3);
  assert.equal(last.start, 20);
  assert.equal(last.end, 23);

  const empty = paginate([], 1, 10);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.totalPages, 1);
});

test('score helpers preserve the canonical 0–100 scale including low and zero scores', () => {
  assert.equal(scoreToPercent(4.5), 5);
  assert.equal(scoreToPercent(0), 0);
  assert.equal(scoreToPercent(1), 1);
  assert.equal(scoreToPercent(101), null);
  assert.equal(scoreToPercent(88), 88);
  assert.equal(scoreToPercent(null), null);
  assert.equal(formatApplicationTimestamp(null), '');
  assert.match(formatApplicationTimestamp(new Date('2026-09-12T10:30:00.000Z')), /\d{2}\/\d{2}\/\d{4}/);
});

test('normalizeViewConfig validates column filters, grouping and widths', () => {
  const config = normalizeViewConfig({
    columns: ['title'],
    filters: {
      columnFilters: [
        { column: 'company', operator: 'contains', value: '  Acme  ' },
        { column: 'status', operator: 'equals', value: '' },
        { column: 'nope', operator: 'contains', value: 'x' },
        { column: 'title', operator: 'made-up', value: 'x' },
        { column: 'platform', operator: 'isEmpty', value: 'ignored' },
        { column: 'company', operator: 'equals', value: 'Globex' },
      ],
    },
    grouping: { column: 'status', direction: 'desc' },
    columnWidths: { title: 'lg', company: 'auto', nope: 'sm', score: 'xxl' },
  });

  assert.deepEqual(config.filters.columnFilters, [
    { column: 'company', operator: 'equals', value: 'Globex' },
    { column: 'platform', operator: 'isEmpty', value: '' },
  ]);
  assert.deepEqual(config.grouping, { column: 'status', direction: 'desc' });
  assert.deepEqual(config.columnWidths, { title: 'lg' });
});

test('normalizeViewConfig drops invalid grouping and widths', () => {
  const config = normalizeViewConfig({
    grouping: { column: 'nope', direction: 'asc' },
    columnWidths: null,
    filters: { columnFilters: 'nope' },
  });
  assert.equal(config.grouping, null);
  assert.deepEqual(config.columnWidths, {});
  assert.deepEqual(config.filters.columnFilters, []);
});

test('normalizeViewConfig restricts date operators to date columns', () => {
  const config = normalizeViewConfig({
    filters: {
      columnFilters: [
        { column: 'createdAt', operator: 'last7Days', value: '' },
        { column: 'updatedAt', operator: 'customRange', startDate: '2026-09-01', endDate: '2026-09-10' },
        { column: 'createdAt', operator: 'customRange', value: '' },
        { column: 'title', operator: 'today', value: '' },
        { column: 'company', operator: 'contains', value: ' Acme ', startDate: '2026-09-01' },
        { column: 'updatedAt', operator: 'contains', value: 'x' },
      ],
    },
  });

  assert.deepEqual(config.filters.columnFilters, [
    { column: 'createdAt', operator: 'last7Days', value: '' },
    { column: 'updatedAt', operator: 'customRange', value: '', startDate: '2026-09-01', endDate: '2026-09-10' },
    { column: 'company', operator: 'contains', value: 'Acme' },
  ]);
});

test('filterApplications applies date column filters', () => {
  const offers = [
    offer({ id: 'today', createdAt: new Date('2026-09-12T08:00:00.000Z') }),
    offer({ id: 'three', createdAt: new Date('2026-09-09T08:00:00.000Z') }),
    offer({ id: 'seven', createdAt: new Date('2026-09-05T08:00:00.000Z') }),
    offer({ id: 'old', createdAt: new Date('2026-08-01T08:00:00.000Z') }),
  ];

  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'createdAt', operator: 'today', value: '' }] }, now).map(o => o.id),
    ['today'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'createdAt', operator: 'last3Days', value: '' }] }, now).map(o => o.id),
    ['today', 'three'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'createdAt', operator: 'last7Days', value: '' }] }, now).map(o => o.id),
    ['today', 'three', 'seven'],
  );
  assert.deepEqual(
    filterApplications(offers, {
      columnFilters: [{ column: 'createdAt', operator: 'customRange', value: '', startDate: '2026-09-09', endDate: '2026-09-10' }],
    }, now).map(o => o.id),
    ['three'],
  );
});

test('normalizeViewConfig validates and normalizes score column filters', () => {
  const config = normalizeViewConfig({
    filters: {
      columnFilters: [
        { column: 'score', operator: 'scoreRange', value: '' }, // invalid: no min or max
        { column: 'score', operator: 'gte90', value: '' },
      ],
    },
  });

  assert.deepEqual(config.filters.columnFilters, [
    { column: 'score', operator: 'gte90', value: '' },
  ]);

  const rangeConfig = normalizeViewConfig({
    filters: {
      columnFilters: [
        { column: 'score', operator: 'scoreRange', minScore: -10, maxScore: 120, value: '' },
      ],
    },
  });
  assert.deepEqual(rangeConfig.filters.columnFilters, [
    { column: 'score', operator: 'scoreRange', minScore: 0, maxScore: 100, value: '' },
  ]);
});

test('filterApplications applies score presets and score range filters', () => {
  const offers = [
    offer({ id: 'top', scoreOverall: 95 }),
    offer({ id: 'high', scoreOverall: 82 }),
    offer({ id: 'good', scoreOverall: 75 }),
    offer({ id: 'tiny', scoreOverall: 4.5 }), // already on the 0–100 scale
    offer({ id: 'mid', scoreOverall: 55 }),
    offer({ id: 'low', scoreOverall: 30 }),
    offer({ id: 'none', scoreOverall: null }),
  ];

  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'gte90', value: '' }] }).map(o => o.id),
    ['top'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'gte80', value: '' }] }).map(o => o.id),
    ['top', 'high'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'gte75', value: '' }] }).map(o => o.id),
    ['top', 'high', 'good'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'gte60', value: '' }] }).map(o => o.id),
    ['top', 'high', 'good'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'gte50', value: '' }] }).map(o => o.id),
    ['top', 'high', 'good', 'mid'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'scoreRange', value: '', minScore: 50, maxScore: 80 }] }).map(o => o.id),
    ['good', 'mid'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'isEmpty', value: '' }] }).map(o => o.id),
    ['none'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'isNotEmpty', value: '' }] }).map(o => o.id),
    ['top', 'high', 'good', 'tiny', 'mid', 'low'],
  );
});

test('normalizeViewConfig keeps multi-select filters and drops unknown statuses', () => {
  const config = normalizeViewConfig({
    filters: {
      columnFilters: [
        { column: 'status', operator: 'in', value: '', values: ['applied', 'nope', 'applied', 'interview'] },
        { column: 'status', operator: 'in', value: '', values: [] },
      ],
    },
  });

  assert.deepEqual(config.filters.columnFilters, [
    { column: 'status', operator: 'in', value: '', values: ['applied', 'interview'] },
  ]);
});

test('filterApplications matches multi-select status filters', () => {
  const offers = [
    offer({ id: 'a', status: 'applied' }),
    offer({ id: 'b', status: 'interested' }),
    offer({ id: 'c', status: 'rejected' }),
  ];

  assert.deepEqual(
    filterApplications(offers, {
      columnFilters: [{ column: 'status', operator: 'in', value: '', values: ['applied', 'interview'] }],
    }).map(o => o.id),
    ['a'],
  );
  assert.deepEqual(
    filterApplications(offers, {
      columnFilters: [{ column: 'status', operator: 'in', value: '', values: [] }],
    }).map(o => o.id),
    ['a', 'b', 'c'],
  );
});

test('normalizeViewConfig normalizes actions position and width', () => {
  const clamped = normalizeViewConfig({ columns: ['title', 'company'], actionsIndex: 99 });
  assert.equal(clamped.actionsIndex, 2);
  assert.equal(normalizeViewConfig({ columns: ['title'], actionsIndex: -3 }).actionsIndex, 0);
  assert.equal(normalizeViewConfig({ columns: ['title'], actionsIndex: 'first' }).actionsIndex, null);
  assert.equal(normalizeViewConfig({ columns: ['title'] }).actionsIndex, null);

  const widths = normalizeViewConfig({
    columnWidths: { actions: 'md', title: 'lg', nope: 'sm', company: 'auto' },
  });
  assert.deepEqual(widths.columnWidths, { actions: 'md', title: 'lg' });
});

test('filterApplications applies per-column filters', () => {
  const offers = [
    offer({ id: 'a', company: 'Acme', status: 'applied', scoreOverall: 80 }),
    offer({ id: 'b', company: 'Globex', status: 'interested', nextFollowupDate: new Date('2026-09-10T00:00:00.000Z') }),
  ];

  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'company', operator: 'contains', value: 'ac' }] }).map(o => o.id),
    ['a'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'status', operator: 'equals', value: 'applied' }] }).map(o => o.id),
    ['a'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'status', operator: 'notEquals', value: 'applied' }] }).map(o => o.id),
    ['b'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'followup', operator: 'isEmpty', value: '' }] }).map(o => o.id),
    ['a'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'score', operator: 'equals', value: '80' }] }).map(o => o.id),
    ['a'],
  );
  assert.deepEqual(
    filterApplications(offers, { columnFilters: [{ column: 'company', operator: 'notContains', value: 'acme' }] }).map(o => o.id),
    ['b'],
  );
});

test('groupApplications groups rows and keeps empty keys last', () => {
  const offers = [
    offer({ id: 'a', status: 'applied', company: 'Acme' }),
    offer({ id: 'b', status: 'interested', company: 'Globex' }),
    offer({ id: 'c', status: 'applied', company: 'Initech' }),
  ];

  const groups = groupApplications(offers, { column: 'status', direction: 'asc' });
  assert.deepEqual(groups.map(group => group.key), ['interested', 'applied']);
  assert.deepEqual(groups[1].offers.map(o => o.id), ['a', 'c']);

  const desc = groupApplications(offers, { column: 'company', direction: 'desc' });
  assert.deepEqual(desc.map(group => group.key), ['Initech', 'Globex', 'Acme']);

  const empties = groupApplications(
    [offer({ id: 'x', company: '' }), offer({ id: 'y', company: 'Acme' })],
    { column: 'company', direction: 'asc' },
  );
  assert.deepEqual(empties.map(group => group.key), ['Acme', '']);

  const byDay = groupApplications(
    [offer({ id: 'n', createdAt: new Date('2026-09-12T08:00:00.000Z') }), offer({ id: 'o', createdAt: new Date('2026-09-01T08:00:00.000Z') })],
    { column: 'createdAt', direction: 'desc' },
  );
  assert.deepEqual(byDay.map(group => group.key), ['2026-09-12', '2026-09-01']);
});

test('company lookup filters by companyId and groups linked rows together', () => {
  const offers = [
    offer({ id: 'a', company: 'Acme', companyId: 'co-1' }),
    offer({ id: 'b', company: 'Globex', companyId: 'co-2' }),
    offer({ id: 'c', company: 'Acme', companyId: 'co-1' }),
  ];

  assert.deepEqual(
    filterApplications(offers, {
      columnFilters: [{ column: 'company', operator: 'in', value: '', values: ['co-1'] }],
    }).map((row) => row.id),
    ['a', 'c'],
  );

  const grouped = groupApplications(offers, { column: 'company', direction: 'asc' });
  assert.deepEqual(grouped.map((group) => group.key), ['co-1', 'co-2']);
  assert.deepEqual(grouped[0].offers.map((row) => row.id), ['a', 'c']);
});

test('filterApplications excludes archived unless status is explicitly filtered', () => {
  const offers = [
    offer({ id: 'a', status: 'applied' }),
    offer({ id: 'b', status: 'archived' }),
  ];

  assert.deepEqual(
    filterApplications(offers, { excludedStatuses: ['archived'] }).map(o => o.id),
    ['a'],
  );
  assert.deepEqual(
    filterApplications(offers, { status: 'archived', excludedStatuses: ['archived'] }).map(o => o.id),
    ['b'],
  );
  assert.deepEqual(
    filterApplications(offers, {
      excludedStatuses: ['archived'],
      columnFilters: [{ column: 'status', operator: 'in', value: '', values: ['archived'] }],
    }).map(o => o.id),
    ['b'],
  );
  assert.deepEqual(
    filterApplications(offers, { excludedStatuses: [] }).map(o => o.id),
    ['a', 'b'],
  );
});

test('normalizeViewConfig defaults to excluding archived and validates statuses', () => {
  assert.deepEqual(normalizeViewConfig({}).filters.excludedStatuses, ['archived']);
  assert.deepEqual(
    normalizeViewConfig({ filters: { excludedStatuses: ['archived', 'nope', 'archived'] } }).filters.excludedStatuses,
    ['archived'],
  );
  assert.deepEqual(normalizeViewConfig({ filters: { excludedStatuses: [] } }).filters.excludedStatuses, []);
});

test('archived status participates in status ordering', () => {
  const offers = [offer({ id: 'a', status: 'archived' }), offer({ id: 'b', status: 'interested' })];
  assert.deepEqual(
    sortApplications(offers, { key: 'status', direction: 'asc' }).map(o => o.id),
    ['b', 'a'],
  );
});
