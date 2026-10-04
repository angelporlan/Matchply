import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getRequestContext } from '@/lib/request-context';
import { getBillingCatalog } from '@/lib/billing-catalog';
import { billingUserColumns, isUserTrialEligible } from '@/lib/billing-service';
import { log } from '@/lib/logger';

export async function GET() {
  const ctx = await getRequestContext();
  let eligible = false;
  if (ctx.realUser && !ctx.impersonation && !ctx.impersonationInvalid) {
    const [user] = await db.select(billingUserColumns).from(users).where(eq(users.id, ctx.realUser.id)).limit(1);
    if (user && !user.isGuest && user.accountStatus === 'active') {
      try { eligible = await isUserTrialEligible(user); }
      catch (error) { log({ event: 'stripe_trial_eligibility_unavailable', level: 'warn', error }); }
    }
  }
  return NextResponse.json(await getBillingCatalog(eligible), { headers: { 'Cache-Control': 'no-store' } });
}

export const dynamic = 'force-dynamic';
