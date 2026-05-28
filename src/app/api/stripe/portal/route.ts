import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, STRIPE_SECRET_KEY } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY) {
      return new NextResponse('Stripe secret key not configured', { status: 500 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
        },
      });

      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, user.id));
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${req.nextUrl.origin}/dashboard`,
    });

    return NextResponse.redirect(portalSession.url);
  } catch (error: any) {
    console.error('Error in Stripe billing portal:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
