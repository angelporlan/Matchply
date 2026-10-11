import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getUsageSnapshot } from '@/lib/usage';
import { getCvAccess } from '@/lib/cv-access';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { log } from '@/lib/logger';
import { areTrialRemindersVerified, isMonetizationEnabled } from '@/lib/billing-catalog';
export async function GET() {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const [snapshot, cv, [user]] = await Promise.all([getUsageSnapshot(actor.userId), getCvAccess(actor.userId), db.select({ endAt: users.stripeTrialEnd, usedAt: users.stripeTrialUsedAt, firstValueAt: users.firstValueAt, paidAt: users.stripePaidAt }).from(users).where(eq(users.id, actor.userId)).limit(1)]);
    return NextResponse.json({ ...snapshot, cv, trial: { endAt: user?.endAt ?? null, eligible: isMonetizationEnabled() && areTrialRemindersVerified() && !user?.usedAt && !user?.paidAt && actor.kind !== 'guest' }, firstValueAt: user?.firstValueAt ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { log({ event: 'usage_load_failed', level: 'error', error }); return NextResponse.json({ error: 'Usage temporarily unavailable' }, { status: 503 }); }
}
export const dynamic = 'force-dynamic';
