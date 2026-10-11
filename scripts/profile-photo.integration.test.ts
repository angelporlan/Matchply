import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const testUrl = process.env.PROFILE_PHOTO_TEST_DATABASE_URL;
test('profile photos persist privately and a manual photo survives sequential and concurrent Google logins', { skip: !testUrl }, async () => {
  const target = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) && target.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users, userAvatars } = await import('@/db/schema');
  const { getProfilePhoto, saveProfilePhoto, seedGoogleProfilePhoto } = await import('@/lib/avatar/profile');
  const { sessionUserColumns } = await import('@/lib/job-offer-queries');
  const { eq, inArray } = await import('drizzle-orm');
  const ids = [randomUUID(), randomUUID()];
  const jpeg = readFileSync('scripts/fixtures/person-avatar.jpg');
  const input = { mime: 'image/jpeg', data: jpeg.toString('base64') };
  const googleImage = 'https://lh3.googleusercontent.com/test-photo';
  try {
    await db.insert(users).values(ids.map(id => ({ id, name: 'Photo test', email: `photo-${id}@example.test` })));
    assert.equal((await seedGoogleProfilePhoto(ids[0], googleImage))?.image, googleImage);
    assert.equal((await seedGoogleProfilePhoto(ids[0], `${googleImage}-new`))?.image, googleImage);
    assert.equal((await seedGoogleProfilePhoto(ids[1], null))?.image, null);
    const saved = await saveProfilePhoto(ids[0], input);
    assert.ok(saved.image.startsWith('/api/account/avatar?v='));
    assert.equal((await getProfilePhoto(ids[0]))?.bytes, input.data);
    assert.equal(await getProfilePhoto(ids[1]), null);
    assert.equal((await seedGoogleProfilePhoto(ids[0], `${googleImage}-later`))?.image, saved.image);
    const [summary] = await db.select(sessionUserColumns).from(users).where(eq(users.id, ids[0]));
    assert.equal(summary.image, saved.image);
    assert.ok(!JSON.stringify(summary).includes(input.data));
    await assert.rejects(saveProfilePhoto(ids[0], { ...input, data: 'invalid' }), /PHOTO_INVALID/);
    assert.equal((await getProfilePhoto(ids[0]))?.bytes, input.data);
    const jpeg2 = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xfe, 0, 7]), Buffer.from('newer'), jpeg.subarray(2)]);
    const saved2 = await saveProfilePhoto(ids[0], { ...input, data: jpeg2.toString('base64') });
    assert.notEqual(saved.image, saved2.image);
    assert.equal((await getProfilePhoto(ids[0]))?.bytes, jpeg2.toString('base64'));
    const [, manual] = await Promise.all([seedGoogleProfilePhoto(ids[1], googleImage), saveProfilePhoto(ids[1], input)]);
    assert.equal((await seedGoogleProfilePhoto(ids[1], googleImage))?.image, manual.image);
    await db.delete(users).where(eq(users.id, ids[0]));
    assert.equal((await db.select().from(userAvatars).where(eq(userAvatars.userId, ids[0]))).length, 0);
  } finally {
    await db.delete(users).where(inArray(users.id, ids));
    await pool.end();
  }
});
