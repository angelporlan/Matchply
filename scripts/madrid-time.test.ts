import test from 'node:test';
import assert from 'node:assert/strict';
import {
  madridDayRange,
  madridLocalToUtc,
  madridRollingRange,
  madridYmd,
  resolveMadridCreatedRange,
} from '@/lib/madrid-time';

test('Madrid civil dates convert through DST', () => {
  const winter = madridLocalToUtc(2026, 1, 15, 0, 0, 0);
  const summer = madridLocalToUtc(2026, 7, 15, 0, 0, 0);
  assert.equal(winter.toISOString(), '2026-01-14T23:00:00.000Z');
  assert.equal(summer.toISOString(), '2026-07-14T22:00:00.000Z');
  assert.equal(madridYmd(winter), '2026-01-15');
  assert.equal(madridYmd(summer), '2026-07-15');
});

test('today and rolling ranges stay exclusive of the next Madrid day', () => {
  const now = new Date('2026-03-29T12:00:00.000Z');
  const today = madridDayRange(madridYmd(now))!;
  assert.ok(today.start < today.end);
  assert.equal(madridYmd(today.start), '2026-03-29');
  const week = madridRollingRange(7, now);
  assert.ok(week.start < week.end);
  assert.equal(madridYmd(week.start), '2026-03-23');
});

test('custom ranges and presets keep stable bounds', () => {
  const range = resolveMadridCreatedRange({
    preset: 'custom',
    from: '2026-03-28',
    to: '2026-03-30',
  });
  assert.ok(range);
  assert.equal(madridYmd(range.start), '2026-03-28');
  assert.equal(madridYmd(new Date(range.end.getTime() - 1)), '2026-03-30');
});
