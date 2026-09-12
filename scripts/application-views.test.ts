import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApplicationSummary } from '@/lib/job-offer-queries';
import {
  DEFAULT_VIEW_CONFIG,
  filterApplications,
  formatApplicationTimestamp,
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

test('score helpers normalize legacy five point scores', () => {
  assert.equal(scoreToPercent(4.5), 90);
  assert.equal(scoreToPercent(88), 88);
  assert.equal(scoreToPercent(null), null);
  assert.equal(formatApplicationTimestamp(null), '');
  assert.match(formatApplicationTimestamp(new Date('2026-09-12T10:30:00.000Z')), /\d{2}\/\d{2}\/\d{4}/);
});
