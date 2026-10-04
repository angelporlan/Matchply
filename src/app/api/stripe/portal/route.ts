import { NextRequest, NextResponse } from 'next/server';
import { requireBillingContext } from '@/lib/request-context';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, STRIPE_SECRET_KEY, getAppUrl } from '@/lib/stripe';
import { log } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY) {
      return new NextResponse('Stripe secret key not configured', { status: 500 });
    }

    const ctx = await requireBillingContext();
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(users)
      .where(eq(users.id, ctx.realUser.id))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const customerId = user.stripeCustomerId;
    if (!customerId) return NextResponse.redirect(`${getAppUrl()}/dashboard/subscription`);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getAppUrl()}/dashboard/subscription`,
    });

    return NextResponse.redirect(portalSession.url);
  } catch (error: any) {
    log({ event: 'stripe_portal_failed', level: 'warn', route: '/api/stripe/portal', error });
    return NextResponse.json({ error: 'portal_unavailable' }, { status: error.message === 'Unauthorized' ? 401 : 'status' in error ? Number(error.status) : 500 });
  }
}

export const dynamic = 'force-dynamic';
