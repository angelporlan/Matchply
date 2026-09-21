import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { insertCriticalAuditLog } from '@/lib/audit';
import { normalizeUserRolePromotionPayload, type UserRolePromotionPayload } from '@/lib/user-role-promotion-contract';

export async function promoteUserToAdmin(input: unknown) {
  const payload: UserRolePromotionPayload = normalizeUserRolePromotionPayload(input);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('internal-admin-promotion'))`);
    const [target] = await tx
      .select({ id: users.id, email: users.email, role: users.role, accountStatus: users.accountStatus, isGuest: users.isGuest })
      .from(users)
      .where(sql`lower(${users.email}) = ${payload.email}`)
      .for('update')
      .limit(1);

    if (!target || target.isGuest) {
      throw new Error('User not found');
    }
    if (target.accountStatus !== 'active') {
      throw new Error('The account must be active');
    }

    if (target.role === 'admin') {
      return { email: target.email, changed: false, fromRole: 'admin', toRole: 'admin' };
    }

    await tx.update(users).set({ role: 'admin' }).where(eq(users.id, target.id));
    await insertCriticalAuditLog(tx as any, {
      action: 'internal_user_role_promotion',
      userEmail: target.email,
      details: { source: 'internal_role_promotion', from: target.role, to: 'admin', reason: payload.reason },
      actorUserId: null,
      affectedUserId: target.id,
      category: 'admin',
    });

    return { email: target.email, changed: true, fromRole: target.role, toRole: 'admin' };
  });
}
