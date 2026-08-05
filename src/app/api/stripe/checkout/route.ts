import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { stripe, STRIPE_SECRET_KEY, STRIPE_PRICE_ID_PRO, getAppUrl } from '@/lib/stripe';
import { ALL_CV_TEMPLATES, isProSubscription } from '@/lib/subscription';

export async function GET(req: NextRequest) {
  try {
    if (!STRIPE_SECRET_KEY) {
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

    const origin = getAppUrl();
    const requestedTemplate = req.nextUrl.searchParams.get('template');
    const template = requestedTemplate && ALL_CV_TEMPLATES.includes(requestedTemplate as typeof ALL_CV_TEMPLATES[number])
      ? requestedTemplate
      : null;
    const sourceParam = req.nextUrl.searchParams.get('source');
    const source = sourceParam && /^[a-zA-Z0-9_-]{1,64}$/.test(sourceParam) ? sourceParam : null;
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
    const priceId = STRIPE_PRICE_ID_PRO;
    if (!priceId || priceId.includes("price_...")) {
      return new NextResponse('Stripe Price ID PRO not configured', { status: 500 });
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
      success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}${template ? `&template=${encodeURIComponent(template)}` : ''}${source ? `&source=${encodeURIComponent(source)}` : ''}`,
      cancel_url: `${origin}/dashboard?checkout=cancel${template ? `&template=${encodeURIComponent(template)}` : ''}${source ? `&source=${encodeURIComponent(source)}` : ''}`,
      allow_promotion_codes: true,
      customer_update: {
        name: 'auto',
        address: 'auto',
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          ...(template ? { template } : {}),
          ...(source ? { source } : {}),
        },
      },
      metadata: {
        userId: user.id,
        ...(template ? { template } : {}),
        ...(source ? { source } : {}),
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
