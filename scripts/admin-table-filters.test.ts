import test from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { ADMIN_USER_COLUMNS, ADMIN_AUDIT_COLUMNS, parseAdminColumnFilters, adminDateBounds } from '@/lib/admin/table-filters';
import { adminColumnFilterSql } from '@/lib/admin/table-filter-sql';
import { parseAdminUserListQuery, userListQueryString } from '@/lib/admin/user-list-query';

test('admin filters reject unknown columns, operators, options and invalid date ranges', () => {
  const filters = parseAdminColumnFilters(JSON.stringify([
    { column: 'passwordHash', operator: 'contains', value: 'secret' },
    { column: 'name', operator: 'rawSQL', value: 'DROP TABLE' },
    { column: 'role', operator: 'in', values: ['unknown', 'admin', 'admin'] },
    { column: 'createdAt', operator: 'customRange', startDate: '2026-02-31' },
    { column: 'lastLoginAt', operator: 'customRange', startDate: '2026-10-05', endDate: '2026-10-01' },
    { column: 'name', operator: 'contains', value: ' ' },
  ]), ADMIN_USER_COLUMNS);
  assert.deepEqual(filters, [{ column: 'role', operator: 'in', value: '', values: ['admin'] }]);
  assert.deepEqual(parseAdminColumnFilters('{broken', ADMIN_AUDIT_COLUMNS), []);
});

test('column filters survive URL round trips and override legacy filters on the same column', () => {
  const query = parseAdminUserListQuery({
    role: 'user', activity: 'none', pageSize: '10', sort: 'plan', dir: 'asc',
    columnFilters: JSON.stringify([
      { column: 'role', operator: 'in', values: ['admin'] },
      { column: 'email', operator: 'notContains', value: '@example.test' },
    ]),
  });
  assert.equal(query.sort, 'plan');
  assert.equal(query.pageSize, 10);
  assert.deepEqual(query.columnFilters.find(filter => filter.column === 'role')?.values, ['admin']);
  assert.equal(query.columnFilters.find(filter => filter.column === 'lastSeenAt')?.operator, 'isEmpty');
  const params = Object.fromEntries(new URLSearchParams(userListQueryString(query)));
  assert.deepEqual(parseAdminUserListQuery(params).columnFilters, query.columnFilters);
  assert.ok(!('createdRange' in params) && !('activityRange' in params));
  assert.equal(parseAdminUserListQuery({ page: 'Infinity' }).page, 1);
  assert.equal(parseAdminUserListQuery({ page: '2.9', sort: 'passwordHash' }).page, 2);
});

test('Madrid date filters include the whole day across the daylight saving transition', () => {
  const bounds = adminDateBounds({ column: 'createdAt', operator: 'customRange', value: '', startDate: '2026-10-25', endDate: '2026-10-25' }, new Date());
  assert.equal(bounds.start?.toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(bounds.end?.toISOString(), '2026-10-25T23:00:00.000Z');
  const openEnded = adminDateBounds({ column: 'createdAt', operator: 'customRange', value: '', endDate: '2026-10-04' }, new Date());
  assert.equal(openEnded.start, undefined);
  assert.equal(openEnded.end?.toISOString(), '2026-10-04T22:00:00.000Z');
});

test('filter values remain parameters and SQL LIKE wildcards are treated as literal text', () => {
  const value = "O'Brien %_\\";
  const filter = { column: 'name', operator: 'contains', value };
  const compiled = new PgDialect().sqlToQuery(adminColumnFilterSql(filter, ADMIN_USER_COLUMNS, { name: sql`"name"` }, new Date()));
  assert.ok(!compiled.sql.includes(value));
  assert.deepEqual(compiled.params, ["%O'Brien \\%\\_\\\\%"]);
});
