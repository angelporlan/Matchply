import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';

const TOUCH_INTERVAL_MS = 5 * 60_000;
const inProcess = new Map<string, number>();

export async function touchLastSeenAt(userId: string, now = new Date()) {
  const last = inProcess.get(userId) || 0;
  if (now.getTime() - last < TOUCH_INTERVAL_MS) return;
  inProcess.set(userId, now.getTime());
  try {
    await db
      .update(users)
      .set({ lastSeenAt: now })
      .where(and(
        eq(users.id, userId),
        or(isNull(users.lastSeenAt), lt(users.lastSeenAt, new Date(now.getTime() - TOUCH_INTERVAL_MS))),
      ));
  } catch {
    inProcess.delete(userId);
  }
}

export async function recordLoginAt(userId: string, now = new Date()) {
  await db.update(users).set({ lastLoginAt: now, lastSeenAt: now }).where(eq(users.id, userId));
}

export function unknownActivityLabel(value: Date | null | undefined) {
  return value ? null : 'Desconocido';
}
