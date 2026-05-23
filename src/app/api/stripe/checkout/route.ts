import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { isProSubscription } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return new NextResponse('Stripe secret key not configured', { status: 500 });
    }

    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;

    // 1. Obtener datos del usuario
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    const origin = req.nextUrl.origin;
    let customerId = user.stripeCustomerId;

    // 2. Crear cliente de Stripe si no existe
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id
        }
      });
      customerId = customer.id;

      await db
        .update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, userId));
    }

    if (isProSubscription(user.subscriptionStatus) && user.stripeSubscriptionId) {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/dashboard`,
      });

      return NextResponse.redirect(portalSession.url);
    }

    // 3. Obtener Stripe Price ID desde variables de entorno
    const priceId = process.env.STRIPE_PRICE_ID_PRO;
    if (!priceId || priceId.includes("price_...")) {
      return new NextResponse('Stripe Price ID Pro not configured', { status: 500 });
    }

    // 4. Crear sesión de checkout de Stripe
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard?checkout=cancel`,
      allow_promotion_codes: true,
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
      metadata: {
        userId: user.id
      }
    });

    if (!checkoutSession.url) {
      throw new Error('Failed to create stripe checkout session URL');
    }

    return NextResponse.redirect(checkoutSession.url);
  } catch (error: any) {
    console.error('Error in Stripe checkout:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
