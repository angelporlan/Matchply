import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const target = process.env.PEOPLE_TEST_DATABASE_URL;

test('quick follow-up preserves profile fields, ownership and an existing date under duplicate clicks', { skip: !target }, async () => {
  const url = new URL(target!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = target;
  const { db, pool } = await import('@/db');
  const { users, people } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { schedulePersonFollowup } = await import('@/lib/people/service');
  const ids = [randomUUID(), randomUUID()], personId = randomUUID(), now = new Date('2026-11-07T10:00:00Z');
  try {
    await db.insert(users).values(ids.map(id => ({ id, email: `followup-${id}@example.test` })));
    await db.insert(people).values({ id: personId, userId: ids[0], name: 'Synthetic contact', notes: 'Keep my notes', role: 'Recruiter', status: 'conversation', nextAction: 'Keep this action' });
    await assert.rejects(schedulePersonFollowup(ids[1], personId, now), /PEOPLE_NOT_FOUND/);
    const results = await Promise.all(Array.from({ length: 3 }, () => schedulePersonFollowup(ids[0], personId, now)));
    for (const row of results) assert.equal(row.nextFollowupAt?.toISOString(), '2026-11-14T10:00:00.000Z');
    const [person] = await db.select().from(people).where(eq(people.id, personId));
    assert.equal(person.notes, 'Keep my notes'); assert.equal(person.nextAction, 'Keep this action'); assert.equal(person.role, 'Recruiter'); assert.equal(person.status, 'conversation');
    const again = await schedulePersonFollowup(ids[0], personId, new Date('2026-12-01T10:00:00Z'));
    assert.equal(again.nextFollowupAt?.valueOf(), person.nextFollowupAt?.valueOf());
    assert.equal(again.updatedAt.valueOf(), person.updatedAt.valueOf());
    await assert.rejects(schedulePersonFollowup(ids[0], randomUUID()), /PEOPLE_NOT_FOUND/);
  } finally { await db.delete(users).where(inArray(users.id, ids)); await pool.end(); }
});
