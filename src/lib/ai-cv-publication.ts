import { and, eq } from 'drizzle-orm';
import { cvs, usageOperations } from '@/db/schema';
import { lockCvUser } from '@/lib/cv-access';
import type { PlanDb } from '@/lib/plan-store';
import { UsageError } from '@/lib/usage';

/** Keep admission authorization and ownership across a guest registration. */
export async function assertUsagePublication(tx: PlanDb, userId: string, operationId: string) {
  // operationId comes from the server's admitted operation. Guest registration
  // may transfer its owner while this request is still streaming.
  // Keep the original actor first, like lockedOperation when it began before a
  // claim. Sorting the new owner first could invert those locks after transfer.
  await lockCvUser(tx, userId);
  const [current] = await tx.select({ userId: usageOperations.userId }).from(usageOperations).where(eq(usageOperations.id, operationId)).limit(1);
  // A transfer that finished before the original owner's lock was acquired is
  // already committed. Holding that lock prevents another concurrent claim.
  if (current && current.userId !== userId) await lockCvUser(tx, current.userId);
  const [operation] = await tx.select({ id: usageOperations.id, status: usageOperations.status, userId: usageOperations.userId }).from(usageOperations)
    .where(eq(usageOperations.id, operationId)).for('update').limit(1);
  if (!operation || operation.status !== 'reserved') throw new UsageError(409, 'OPERATION_RELEASED', 'Esta operación ya no puede guardar un resultado.');
  return operation.userId;
}

/** An admitted operation keeps its authorization when plan limits change while AI is running. */
export async function assertCvPublication(tx: PlanDb, userId: string, cvId: string, operationId: string) {
  const ownerId = await assertUsagePublication(tx, userId, operationId);
  const [target] = await tx.select({ id: cvs.id, pendingOperationId: cvs.pendingUsageOperationId }).from(cvs)
    .where(and(eq(cvs.id, cvId), eq(cvs.userId, ownerId))).for('update').limit(1);
  if (!target || target.pendingOperationId !== operationId) throw new UsageError(409, 'CV_OPERATION_LOST', 'El destino de esta generación ya no está disponible.');
  return ownerId;
}
