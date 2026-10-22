import { NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { getUsageSnapshot } from '@/lib/usage';
import { getCvAccess } from '@/lib/cv-access';
import { db, pool } from '@/db';
import { getUserPlan } from '@/lib/plan-store';
import { log } from '@/lib/logger';
import { areTrialRemindersVerified, isMonetizationEnabled } from '@/lib/billing-catalog';
export async function GET() {
  const started = Date.now();
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const context = await getUserPlan(actor.userId);
    const [snapshot, cv] = await Promise.all([getUsageSnapshot(actor.userId, db, context), getCvAccess(actor.userId, db, context)]);
    const { user } = context;
    log({ event: 'usage_loaded', durationMs: Date.now() - started, poolWaiting: pool.waitingCount, poolTotal: pool.totalCount });
    return NextResponse.json({ ...snapshot, cv, trial: { endAt: user.stripeTrialEnd ?? null, eligible: isMonetizationEnabled() && areTrialRemindersVerified() && !user.stripeTrialUsedAt && !user.stripePaidAt && actor.kind !== 'guest' }, firstValueAt: user.firstValueAt ?? null }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { log({ event: 'usage_load_failed', level: 'error', error }); return NextResponse.json({ error: 'Usage temporarily unavailable' }, { status: 503 }); }
}
export const dynamic = 'force-dynamic';
