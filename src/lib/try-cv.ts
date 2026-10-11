import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { cvs } from '@/db/schema';
import { lockCvUser, requireCvCreation } from '@/lib/cv-access';
import { UsageError } from '@/lib/usage';

/** Store the demo's source document atomically and replay a lost response safely. */
export async function createTrySourceCv(userId: string, input: { id: string; title: string; content: string }) {
  if (!input || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)
    || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200
    || typeof input.content !== 'string' || !input.content.trim() || input.content.length > 120_000) {
    throw new UsageError(400, 'INVALID_CV_INPUT', 'Invalid resume input');
  }
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const [existing] = await tx.select({ id: cvs.id, userId: cvs.userId, title: cvs.title, content: cvs.content, isBase: cvs.isBase })
      .from(cvs).where(eq(cvs.id, input.id)).limit(1);
    if (existing) {
      if (existing.userId !== userId || !existing.isBase || existing.title !== input.title || existing.content !== input.content) {
        throw new UsageError(409, 'OPERATION_CONFLICT', 'This operation was already used with different input');
      }
      return existing.id;
    }
    await requireCvCreation(tx, userId, { isBase: true });
    await tx.update(cvs).set({ isPrincipal: false, updatedAt: sql`${cvs.updatedAt}` }).where(eq(cvs.userId, userId));
    const [created] = await tx.insert(cvs).values({ id: input.id, userId, title: input.title, content: input.content,
      isBase: true, isPrincipal: true, templateName: 'harvard' }).returning({ id: cvs.id });
    return created.id;
  });
}
