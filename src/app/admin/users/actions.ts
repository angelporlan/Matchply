'use server';

import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { users } from '@/db/schema';
import { insertCriticalAuditLog } from '@/lib/audit';
import { requireAdminContext, auditActorFields } from '@/lib/request-context';
import { parseYmd, madridLocalToUtc } from '@/lib/madrid-time';
import { isProGrantActive } from '@/lib/subscription';

function requireReason(reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 8) {
    throw new Error('Indica un motivo de al menos 8 caracteres.');
  }
  return trimmed;
}

export async function updateUserRoleAction(userId: string, newRole: 'user' | 'admin') {
  const { admin, ...ctx } = await requireAdminContext();
  if (newRole !== 'user' && newRole !== 'admin') {
    return { success: false, error: 'Rol no válido.' };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('admin-role-change'))`);
      const [target] = await tx
        .select({ id: users.id, role: users.role, accountStatus: users.accountStatus, email: users.email, isGuest: users.isGuest })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')
        .limit(1);
      if (!target || target.isGuest) throw new Error('Usuario no encontrado.');
      if (target.role === newRole) return;

      if (newRole === 'user' && target.role === 'admin') {
        const [count] = await tx
          .select({ n: sql<number>`cast(count(*) as int)` })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.accountStatus, 'active'), eq(users.isGuest, false)));
        if (Number(count?.n || 0) <= 1) {
          throw new Error('No puedes retirar el último administrador activo.');
        }
      }

      await tx.update(users).set({ role: newRole }).where(eq(users.id, userId));
      await insertCriticalAuditLog(tx as any, {
        action: 'admin_user_role_change',
        userId: admin.id,
        userEmail: admin.email,
        details: { targetUserId: userId, from: target.role, to: newRole },
        ...auditActorFields(ctx),
        affectedUserId: userId,
        category: 'admin',
      });
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'No se pudo cambiar el rol.' };
  }
}

export async function suspendUserAction(userId: string, reason: string) {
  const { admin, ...ctx } = await requireAdminContext();
  try {
    const trimmed = requireReason(reason);
    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('admin-role-change'))`);
      const [target] = await tx
        .select({ id: users.id, role: users.role, email: users.email, isGuest: users.isGuest, accountStatus: users.accountStatus })
        .from(users)
        .where(eq(users.id, userId))
        .for('update')
        .limit(1);
      if (!target || target.isGuest) throw new Error('Usuario no encontrado.');
      if (target.id === admin.id) throw new Error('No puedes suspender tu propia cuenta.');
      if (target.role === 'admin') {
        const [count] = await tx
          .select({ n: sql<number>`cast(count(*) as int)` })
          .from(users)
          .where(and(eq(users.role, 'admin'), eq(users.accountStatus, 'active'), eq(users.isGuest, false)));
        if (Number(count?.n || 0) <= 1) {
          throw new Error('No puedes suspender al último administrador activo.');
        }
      }
      await tx.update(users).set({
        accountStatus: 'suspended',
        suspensionReason: trimmed,
        suspendedAt: new Date(),
        suspendedByUserId: admin.id,
      }).where(eq(users.id, userId));
      await insertCriticalAuditLog(tx as any, {
        action: 'admin_user_suspend',
        userId: admin.id,
        userEmail: admin.email,
        details: { targetUserId: userId, reason: trimmed },
        ...auditActorFields(ctx),
        affectedUserId: userId,
        category: 'admin',
      });
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'No se pudo suspender la cuenta.' };
  }
}

export async function reactivateUserAction(userId: string, reason: string) {
  const { admin, ...ctx } = await requireAdminContext();
  try {
    const trimmed = requireReason(reason);
    await db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id, email: users.email, isGuest: users.isGuest }).from(users).where(eq(users.id, userId)).limit(1);
      if (!target || target.isGuest) throw new Error('Usuario no encontrado.');
      await tx.update(users).set({
        accountStatus: 'active',
        suspensionReason: null,
        suspendedAt: null,
        suspendedByUserId: null,
      }).where(eq(users.id, userId));
      await insertCriticalAuditLog(tx as any, {
        action: 'admin_user_reactivate',
        userId: admin.id,
        userEmail: admin.email,
        details: { targetUserId: userId, reason: trimmed },
        ...auditActorFields(ctx),
        affectedUserId: userId,
        category: 'admin',
      });
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'No se pudo reactivar la cuenta.' };
  }
}

export async function grantProAccessAction(userId: string, reason: string, untilIso: string) {
  const { admin, ...ctx } = await requireAdminContext();
  try {
    const trimmed = requireReason(reason);
    const parsed = parseYmd(untilIso.slice(0, 10));
    if (!parsed) throw new Error('Fecha de vencimiento no válida.');
    const until = madridLocalToUtc(parsed.year, parsed.month, parsed.day, 23, 59, 59);
    if (until.getTime() <= Date.now()) throw new Error('La fecha de vencimiento debe ser futura.');
    await db.transaction(async (tx) => {
      const [target] = await tx.select({ id: users.id, email: users.email, isGuest: users.isGuest }).from(users).where(eq(users.id, userId)).limit(1);
      if (!target || target.isGuest) throw new Error('Usuario no encontrado.');
      await tx.update(users).set({
        proGrantedUntil: until,
        proGrantedReason: trimmed,
        proGrantedByUserId: admin.id,
      }).where(eq(users.id, userId));
      await insertCriticalAuditLog(tx as any, {
        action: 'admin_pro_grant',
        userId: admin.id,
        userEmail: admin.email,
        details: { targetUserId: userId, reason: trimmed, until: until.toISOString() },
        ...auditActorFields(ctx),
        affectedUserId: userId,
        category: 'admin',
      });
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'No se pudo conceder Pro.' };
  }
}

export async function revokeProAccessAction(userId: string, reason: string) {
  const { admin, ...ctx } = await requireAdminContext();
  try {
    const trimmed = requireReason(reason);
    await db.transaction(async (tx) => {
      const [target] = await tx.select({
        id: users.id,
        email: users.email,
        isGuest: users.isGuest,
        proGrantedUntil: users.proGrantedUntil,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (!target || target.isGuest) throw new Error('Usuario no encontrado.');
      if (!isProGrantActive(target.proGrantedUntil)) {
        throw new Error('No hay una concesión Pro vigente.');
      }
      await tx.update(users).set({
        proGrantedUntil: null,
        proGrantedReason: null,
        proGrantedByUserId: null,
      }).where(eq(users.id, userId));
      await insertCriticalAuditLog(tx as any, {
        action: 'admin_pro_revoke',
        userId: admin.id,
        userEmail: admin.email,
        details: { targetUserId: userId, reason: trimmed },
        ...auditActorFields(ctx),
        affectedUserId: userId,
        category: 'admin',
      });
    });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${userId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'No se pudo retirar Pro.' };
  }
}
