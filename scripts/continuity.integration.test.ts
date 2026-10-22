import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { eq, and, sql } from 'drizzle-orm';

const url = process.env.CONTINUITY_TEST_DATABASE_URL;
test('continuity transactions, exact documents, permissions, claim and cleanup', { skip: !url }, async t => {
  const parsed = new URL(url!); assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.includes('test'));
  process.env.DATABASE_URL = url;
  const { db, pool } = await import('@/db');
  const { users, cvs, jobOffers, cvExports, cvExportData, applicationEvents } = await import('@/db/schema');
  const { applyApplicationCommand, deleteOwnedApplication } = await import('@/lib/application-continuity');
  const { storePdfExport, cleanupPdfExports } = await import('@/lib/cv-export');
  const { transferGuestCrm } = await import('@/lib/guest-crm-claim');
  const { getProductFunnel } = await import('@/lib/product-funnel');
  const owner = randomUUID(); const other = randomUUID();
  await db.insert(users).values([{ id: owner, email: `continuity-${owner}@example.test` }, { id: other, email: `continuity-${other}@example.test` }]);
  const [cv] = await db.insert(cvs).values({ userId: owner, title: 'Original', content: '# Synthetic', isBase: true }).returning();
  const [offer] = await db.insert(jobOffers).values({ userId: owner, title: 'Role', company: 'Synthetic employer', cvId: cv.id }).returning();
  const execute = (input: Parameters<typeof applyApplicationCommand>[3]) => db.transaction(tx => applyApplicationCommand(tx, owner, offer.id, input));
  const buffer = Buffer.from('%PDF-1.4\nexact exported bytes\n%%EOF');
  try {
    await t.test('replay, conflicting command and concurrent stale follow-up are safe', async () => {
      const commandId = randomUUID(); const first = await execute({ commandId, status: 'applied' });
      assert.ok(first.nextFollowupDate);
      await execute({ commandId, status: 'applied' });
      assert.equal((await db.select().from(applicationEvents).where(eq(applicationEvents.offerId, offer.id))).length, 1);
      await assert.rejects(execute({ commandId, status: 'interview' }), /COMMAND_CONFLICT/);
      await execute({ action: 'postpone', version: first.followupVersion, nextFollowupDate: new Date('2026-12-01T10:00:00Z'), nextAction: 'Ask for update' });
      await assert.rejects(execute({ action: 'complete', version: first.followupVersion }), /FOLLOWUP_CONFLICT/);
      const [current] = await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id));
      await execute({ action: 'complete', version: current.followupVersion });
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id)))[0].nextFollowupDate, null);
      await assert.rejects(db.transaction(tx => applyApplicationCommand(tx, other, offer.id, { status: 'offer' })), /NOT_FOUND/);
    });
    let exportId = '';
    await t.test('same PDF is deduplicated; confirmation survives editable CV deletion', async () => {
      exportId = await storePdfExport({ userId: owner, cvId: cv.id, buffer, filename: 'exact.pdf', pages: 1 });
      assert.equal(await storePdfExport({ userId: owner, cvId: cv.id, buffer, filename: 'exact.pdf', pages: 1 }), exportId);
      await execute({ action: 'sent', exportId, commandId: randomUUID() });
      await db.update(cvs).set({ content: '# Changed', fontFamily: 'times' }).where(eq(cvs.id, cv.id));
      await db.delete(cvs).where(eq(cvs.id, cv.id));
      const [saved] = await db.select().from(cvExportData).where(eq(cvExportData.exportId, exportId));
      assert.deepEqual(Buffer.from(saved.bytes, 'base64'), buffer);
      assert.equal((await db.select().from(cvExports).where(eq(cvExports.id, exportId)))[0].expiresAt, null);
      assert.equal((await db.select().from(cvExports).where(eq(cvExports.id, exportId)))[0].provenance?.cvId, cv.id);
      const [foreignOffer] = await db.insert(jobOffers).values({ userId: other, title: 'Other', company: 'Other' }).returning();
      await assert.rejects(db.transaction(tx => applyApplicationCommand(tx, other, foreignOffer.id, { action: 'sent', exportId })), /EXPORT_NOT_AVAILABLE/);
    });
    await t.test('responses are explicit and a PDF download alone is not a response', async () => {
      assert.equal((await getProductFunnel(owner)).responded, 0);
      await execute({ action: 'response', commandId: randomUUID() });
      assert.equal((await getProductFunnel(owner)).responded, 1);
    });
    await t.test('confirmed evidence appends to the latest profile, invalidates match and is idempotent', async () => {
      const { persistRequirementEvidence } = await import('@/lib/profile-evidence');
      const { MATCH_PROMPT_VERSION } = await import('@/lib/matching/types');
      await db.update(users).set({ careerProfile: { bio: 'Synthetic professional', masterDocument: 'Existing declared experience.', preferredLocations: 'Murcia' } }).where(eq(users.id, owner));
      const inputHash = 'a'.repeat(64);
      await db.update(jobOffers).set({ scoreOverall: 20, matchInputHash: inputHash, matchEvidence: { version: MATCH_PROMPT_VERSION, inputHash, score: 20, requirements: [{ id: 'r1', name: 'Customer service', status: 'missing' }], adjustments: [] } }).where(eq(jobOffers.id, offer.id));
      const input = { offerId: offer.id, requirementId: 'r1', inputHash, example: 'During a supervised placement I answered customer enquiries and recorded the actions taken.', commandId: randomUUID() };
      await persistRequirementEvidence(owner, input);
      await persistRequirementEvidence(owner, input);
      const [user] = await db.select({ profile: users.careerProfile }).from(users).where(eq(users.id, owner));
      const profile = user.profile as { masterDocument: string; preferredLocations: string };
      assert.equal(profile.preferredLocations, 'Murcia');
      assert.equal(profile.masterDocument.split(input.example).length, 2);
      assert.ok(profile.masterDocument.includes('Existing declared experience.'));
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.id, offer.id)))[0].matchInputHash, null);
      await assert.rejects(persistRequirementEvidence(owner, { ...input, commandId: randomUUID() }), /STALE_REQUIREMENT/);
      await assert.rejects(persistRequirementEvidence(other, { ...input, commandId: randomUUID() }), /STALE_REQUIREMENT/);
    });
    await t.test('ownership transfer moves documents and events without losing bytes', async () => {
      await db.transaction(tx => transferGuestCrm(tx, owner, other));
      await db.delete(users).where(eq(users.id, owner));
      assert.equal((await db.select().from(cvExports).where(eq(cvExports.id, exportId)))[0].userId, other);
      assert.equal((await db.select().from(applicationEvents).where(and(eq(applicationEvents.exportId, exportId), eq(applicationEvents.kind, 'sent'))))[0].userId, other);
      assert.deepEqual(Buffer.from((await db.select().from(cvExportData).where(eq(cvExportData.exportId, exportId)))[0].bytes, 'base64'), buffer);
    });
    await t.test('optional transfer extension restores bytes and events without inventing a transition', async () => {
      const { importContinuity, normalizeContinuityPackage } = await import('@/lib/continuity-transfer');
      const { createHash } = await import('node:crypto');
      assert.equal(normalizeContinuityPackage(undefined), null);
      assert.throws(() => normalizeContinuityPackage({ version: 2 }), /INVALID_CONTINUITY_VERSION/);
      const [destination] = await db.insert(jobOffers).values({ userId: other, title: 'Restored', company: 'Synthetic', status: 'applied' }).returning();
      const restoredId = randomUUID(); const sourceOffer = randomUUID();
      const extension = { version: 1 as const, exports: [{ id: restoredId, cvId: null, hash: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.toString('base64'), filename: 'retained.pdf', byteSize: buffer.length, pages: 1, createdAt: new Date().toISOString(), expiresAt: null }], events: [{ id: randomUUID(), offerId: sourceOffer, commandId: randomUUID(), inputHash: 'synthetic', kind: 'sent', exportId: restoredId, payload: {}, createdAt: new Date().toISOString() }], evidence: [] };
      await db.transaction(tx => importContinuity(tx, other, extension, new Map(), new Map([[sourceOffer, destination.id]])));
      await db.transaction(tx => importContinuity(tx, other, extension, new Map(), new Map([[sourceOffer, destination.id]])));
      assert.deepEqual(Buffer.from((await db.select().from(cvExportData).where(eq(cvExportData.exportId, restoredId)))[0].bytes, 'base64'), buffer);
      assert.equal((await db.select().from(jobOffers).where(eq(jobOffers.id, destination.id)))[0].nextFollowupDate, null);
      await assert.rejects(db.transaction(tx => importContinuity(tx, other, { ...extension, exports: [{ ...extension.exports[0], hash: '0'.repeat(64) }] }, new Map(), new Map([[sourceOffer, destination.id]]))), /INVALID_CONTINUITY_PDF/);
    });
    await t.test('deleting an application preserves shared documents until the last submission is deleted', async () => {
      const [second] = await db.insert(jobOffers).values({ userId: other, title: 'Another submission', company: 'Synthetic' }).returning();
      await db.transaction(tx => applyApplicationCommand(tx, other, second.id, { action: 'sent', exportId }));
      await deleteOwnedApplication(other, offer.id);
      assert.equal((await db.select().from(cvExportData).where(eq(cvExportData.exportId, exportId))).length, 1);
      await deleteOwnedApplication(other, second.id);
      assert.equal((await db.select().from(cvExportData).where(eq(cvExportData.exportId, exportId))).length, 0);
    });
    await t.test('bounded cleanup removes expired temporary documents and retains fresh ones', async () => {
      const [source] = await db.insert(cvs).values({ userId: other, title: 'Cleanup', content: '# Synthetic' }).returning();
      const expired = await storePdfExport({ userId: other, cvId: source.id, buffer, filename: 'expired.pdf', pages: 1 });
      const fresh = await storePdfExport({ userId: other, cvId: source.id, buffer: Buffer.from('%PDF-1.4\nfresh bytes\n%%EOF'), filename: 'fresh.pdf', pages: 1 });
      await db.update(cvExports).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(cvExports.id, expired));
      await cleanupPdfExports();
      assert.equal((await db.select().from(cvExportData).where(eq(cvExportData.exportId, expired))).length, 0);
      assert.equal((await db.select().from(cvExportData).where(eq(cvExportData.exportId, fresh))).length, 1);
    });
  } finally { await db.delete(users).where(sql`${users.id} in (${owner}::uuid, ${other}::uuid)`); await pool.end(); }
});
