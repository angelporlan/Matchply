import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAdminUserListQuery, userListQueryString } from '@/lib/admin/user-list-query';

test('user list query keeps filters in the URL and defaults page size to 25', () => {
  const parsed = parseAdminUserListQuery({
    q: 'ana',
    role: 'user',
    plan: 'granted',
    status: 'active',
    activity: 'none',
    sort: 'lastSeenAt',
    dir: 'asc',
    page: '2',
    pageSize: '50',
  });
  assert.equal(parsed.pageSize, 50);
  assert.equal(parsed.page, 2);
  assert.equal(parsed.plan, 'granted');
  assert.equal(parsed.activity, 'none');
  const href = userListQueryString(parsed);
  assert.match(href, /q=ana/);
  assert.match(href, /page=2/);
  assert.match(href, /pageSize=50/);
});

test('unknown sort and page sizes fall back without duplicating rows', () => {
  const parsed = parseAdminUserListQuery({ sort: 'hack', pageSize: '999', page: '0' });
  assert.equal(parsed.sort, 'createdAt');
  assert.equal(parsed.pageSize, 25);
  assert.equal(parsed.page, 1);
  assert.equal(parsed.dir, 'desc');
});
