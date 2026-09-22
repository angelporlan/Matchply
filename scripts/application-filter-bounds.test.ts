import test from 'node:test';
import assert from 'node:assert/strict';
import {
  columnDateRange,
  dateFilterRange,
  emptyStatusCounts,
  escapeIlikePattern,
  scoreFilterRange,
} from '../src/lib/application-filter-bounds';

const now = new Date('2026-09-20T15:00:00.000Z');

test('escapeIlikePattern treats user wildcards as literals', () => {
  assert.equal(escapeIlikePattern('100%_dev'), '100\\%\\_dev');
});

test('dateFilterRange keeps today and rolling 7 days exclusive of the next day', () => {
  const today = dateFilterRange({ date: 'today' }, now);
  assert.equal(today.start?.getFullYear(), now.getFullYear());
  assert.equal(today.start?.getMonth(), now.getMonth());
  assert.equal(today.start?.getDate(), now.getDate());
  assert.ok(today.end && today.end > today.start!);

  const week = dateFilterRange({ date: '7days' }, now);
  assert.ok(week.start && week.end);
  assert.equal((week.end.getTime() - week.start.getTime()) / 86400000, 8);
});

test('scoreFilterRange covers named thresholds and custom bounds', () => {
  assert.deepEqual(scoreFilterRange({ column: 'score', operator: 'gte75', value: '' }), { min: 75, max: undefined });
  assert.deepEqual(
    scoreFilterRange({ column: 'score', operator: 'scoreRange', value: '', minScore: 10, maxScore: 40 }),
    { min: 10, max: 40 },
  );
});

test('columnDateRange last7Days is inclusive of today', () => {
  const range = columnDateRange({ column: 'createdAt', operator: 'last7Days', value: '' }, now);
  assert.ok(range.start && range.end);
  assert.ok(range.end > range.start);
});

test('emptyStatusCounts starts at zero', () => {
  assert.equal(emptyStatusCounts().all, 0);
  assert.equal(emptyStatusCounts().archived, 0);
});
