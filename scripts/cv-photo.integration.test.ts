import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const testUrl = process.env.CV_PHOTO_TEST_DATABASE_URL;
test('CV photo defaults to hidden, uses the account and keeps overrides private and editable', { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.includes('test'));
  process.env.DATABASE_URL = testUrl;
  const { db, pool } = await import('@/db');
  const { users, cvs, cvPhotos } = await import('@/db/schema');
  const { eq, inArray } = await import('drizzle-orm');
  const { saveProfilePhoto, getProfilePhoto } = await import('@/lib/avatar/profile');
  const { getCvPhotoState, resolveCvPhoto, saveCvPhoto, setCvPhotoEnabled, resetCvPhoto } = await import('@/lib/cv-photo');
  const { cvListColumns } = await import('@/lib/job-offer-queries');
  const owner = randomUUID(), other = randomUUID(), free = randomUUID();
  const jpeg = readFileSync('scripts/fixtures/person-avatar.jpg');
  const avatar = { mime: 'image/jpeg', data: jpeg.toString('base64') };
  try {
    await db.insert(users).values([owner, other, free].map(id => ({ id, email: `cv-photo-${id}@example.test`, subscriptionStatus: id === free ? 'none' : 'active' })));
    const [cv, second, blocked] = await db.insert(cvs).values([
      { userId: owner, title: 'First', content: '# Candidate', isBase: true },
      { userId: owner, title: 'Second', content: '# Candidate' },
      { userId: free, title: 'Read only base', content: '# Retained', isBase: true, updatedAt: new Date(0) },
    ]).returning();
    await db.insert(cvs).values({ userId: free, title: 'Active base', content: '# Current', isBase: true });
    assert.equal(cv.showPhoto, false);
    assert.deepEqual(await getCvPhotoState(owner, cv.id), { enabled: false, url: null, source: null });
    await assert.rejects(setCvPhotoEnabled(owner, cv.id, true), error => (error as { code: string }).code === 'PHOTO_MISSING');
    await saveProfilePhoto(owner, avatar);
    const account = await getProfilePhoto(owner); assert.ok(account);
    const enabled = await setCvPhotoEnabled(owner, cv.id, true);
    assert.equal(enabled.enabled, true); assert.equal(enabled.source, 'account');
    assert.ok(enabled.url?.includes(account.hash));
    assert.deepEqual(await getCvPhotoState(owner, cv.id), enabled);
    assert.equal((await getCvPhotoState(owner, second.id)).enabled, false);
    const changed = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xfe, 0, 7]), Buffer.from('other'), jpeg.subarray(2)]);
    const override = await saveCvPhoto(owner, cv.id, { ...avatar, data: changed.toString('base64') });
    assert.equal(override.source, 'custom'); assert.notEqual(override.url, enabled.url);
    assert.equal((await getProfilePhoto(owner))?.hash, account.hash);
    assert.equal((await resolveCvPhoto(owner, second.id))?.hash, account.hash);
    const hidden = await setCvPhotoEnabled(owner, cv.id, false);
    assert.equal(hidden.url, null);
    assert.equal((await setCvPhotoEnabled(owner, cv.id, true)).url, override.url);
    const reset = await resetCvPhoto(owner, cv.id);
    assert.equal(reset.source, 'account'); assert.equal(reset.url, enabled.url);
    for (const action of [() => resolveCvPhoto(other, cv.id), () => saveCvPhoto(other, cv.id, avatar), () => setCvPhotoEnabled(other, cv.id, false), () => resetCvPhoto(other, cv.id)]) await assert.rejects(action(), error => (error as { code: string }).code === 'CV_NOT_FOUND');
    await assert.rejects(saveCvPhoto(free, blocked.id, avatar), error => (error as { code: string }).code === 'CV_READ_ONLY');
    await assert.rejects(setCvPhotoEnabled(owner, cv.id, 'true'), error => (error as { code: string }).code === 'PHOTO_INVALID');
    await assert.rejects(saveCvPhoto(owner, cv.id, { ...avatar, data: 'invalid' }), /PHOTO_INVALID/);
    await db.update(cvs).set({ pendingUsageOperationId: randomUUID() }).where(eq(cvs.id, cv.id));
    await assert.rejects(saveCvPhoto(owner, cv.id, avatar), error => (error as { code: string }).code === 'OPERATION_IN_PROGRESS');
    await assert.rejects(setCvPhotoEnabled(owner, cv.id, false), error => (error as { code: string }).code === 'OPERATION_IN_PROGRESS');
    await assert.rejects(resetCvPhoto(owner, cv.id), error => (error as { code: string }).code === 'OPERATION_IN_PROGRESS');
    await db.update(cvs).set({ pendingUsageOperationId: null }).where(eq(cvs.id, cv.id));
    await saveCvPhoto(owner, cv.id, avatar);
    const [listing] = await db.select(cvListColumns).from(cvs).where(eq(cvs.id, cv.id));
    assert.ok(!JSON.stringify(listing).includes(avatar.data));
    const [saved] = await db.select({ content: cvs.content }).from(cvs).where(eq(cvs.id, cv.id));
    assert.equal(saved.content, '# Candidate');
    await db.delete(cvs).where(eq(cvs.id, cv.id));
    assert.equal((await db.select().from(cvPhotos).where(eq(cvPhotos.cvId, cv.id))).length, 0);
  } finally { await db.delete(users).where(inArray(users.id, [owner, other, free])); await pool.end(); }
});
