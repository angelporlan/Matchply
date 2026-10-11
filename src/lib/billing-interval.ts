import type Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { stripe, STRIPE_SECRET_KEY, type BillingInterval } from '@/lib/stripe';
import { getBillingPrices, isBillingPortalReady, isMonetizationEnabled } from '@/lib/billing-catalog';
import { BillingError } from '@/lib/billing-service';
import { stripeSubscriptionPeriodEnd, subscriptionHasConfirmedAccess } from '@/lib/billing-policy';
import { retrieveCurrentStripeSubscription } from '@/lib/stripe-subscription-sync';

const MANAGED_SCHEDULE = 'matchply-interval';
const id = (value: string | { id: string } | null | undefined) => typeof value === 'string' ? value : value?.id;
const intervalOf = (price: { recurring?: { interval?: string } | null }): BillingInterval | null => price.recurring?.interval === 'month' ? 'monthly' : price.recurring?.interval === 'year' ? 'annual' : null;

export type BillingIntervalState = {
  canChange: boolean; currentInterval: BillingInterval | null; currentPrice: { amount: number; currency: string } | null;
  renewsAt: string | null; scheduled: { interval: BillingInterval; effectiveAt: string } | null; reason?: string;
};

function discounts(values: Stripe.SubscriptionSchedule.Phase.Discount[]) {
  return values.map(value => {
    const discount = id(value.discount);
    if (discount) return { discount };
    const promotion_code = id(value.promotion_code);
    return promotion_code ? { promotion_code } : { coupon: id(value.coupon)! };
  });
}

/** Preserve phase-level and item-level contract settings while changing only a future Price. */
export function preserveSchedulePhase(phase: Stripe.SubscriptionSchedule.Phase): Stripe.SubscriptionScheduleUpdateParams.Phase {
  return {
    start_date: phase.start_date, end_date: phase.end_date,
    items: phase.items.map(item => ({
      price: id(item.price)!, ...(item.quantity !== undefined ? { quantity: item.quantity } : {}),
      ...(item.discounts?.length ? { discounts: discounts(item.discounts) } : { discounts: '' as const }),
      ...(item.tax_rates?.length ? { tax_rates: item.tax_rates.map(value => id(value)!) } : {}),
      ...(item.billing_thresholds?.usage_gte != null ? { billing_thresholds: { usage_gte: item.billing_thresholds.usage_gte } } : {}),
      ...(item.metadata ? { metadata: item.metadata } : {}),
    })),
    ...(phase.discounts?.length ? { discounts: discounts(phase.discounts) } : { discounts: '' as const }),
    ...(phase.default_tax_rates?.length ? { default_tax_rates: phase.default_tax_rates.map(value => value.id) } : {}),
    ...(phase.automatic_tax ? { automatic_tax: { enabled: phase.automatic_tax.enabled, ...(phase.automatic_tax.liability ? { liability: { type: phase.automatic_tax.liability.type, ...(id(phase.automatic_tax.liability.account) ? { account: id(phase.automatic_tax.liability.account) } : {}) } } : {}) } } : {}),
    ...(phase.application_fee_percent !== null && phase.application_fee_percent !== undefined ? { application_fee_percent: phase.application_fee_percent } : {}),
    ...(phase.billing_cycle_anchor ? { billing_cycle_anchor: phase.billing_cycle_anchor } : {}),
    ...(phase.billing_thresholds ? { billing_thresholds: { ...(phase.billing_thresholds.amount_gte !== null ? { amount_gte: phase.billing_thresholds.amount_gte } : {}), ...(phase.billing_thresholds.reset_billing_cycle_anchor !== null ? { reset_billing_cycle_anchor: phase.billing_thresholds.reset_billing_cycle_anchor } : {}) } } : {}),
    ...(phase.collection_method ? { collection_method: phase.collection_method } : {}),
    ...(id(phase.default_payment_method) ? { default_payment_method: id(phase.default_payment_method) } : {}),
    ...(phase.description !== null && phase.description !== undefined ? { description: phase.description } : {}),
    ...(phase.invoice_settings ? { invoice_settings: {
      ...(phase.invoice_settings.account_tax_ids ? { account_tax_ids: phase.invoice_settings.account_tax_ids.map(value => id(value)!) } : {}),
      ...(phase.invoice_settings.days_until_due !== null ? { days_until_due: phase.invoice_settings.days_until_due } : {}),
      ...(phase.invoice_settings.custom_fields ? { custom_fields: phase.invoice_settings.custom_fields } : {}),
      ...(phase.invoice_settings.description !== null ? { description: phase.invoice_settings.description } : {}),
      ...(phase.invoice_settings.footer !== null ? { footer: phase.invoice_settings.footer } : {}),
      ...(phase.invoice_settings.issuer ? { issuer: { type: phase.invoice_settings.issuer.type, ...(id(phase.invoice_settings.issuer.account) ? { account: id(phase.invoice_settings.issuer.account) } : {}) } } : {}),
    } } : {}),
    ...(phase.metadata ? { metadata: phase.metadata } : {}),
    ...(id(phase.on_behalf_of) ? { on_behalf_of: id(phase.on_behalf_of) } : {}),
    ...(phase.transfer_data ? { transfer_data: { destination: id(phase.transfer_data.destination)!, ...(phase.transfer_data.amount_percent !== null ? { amount_percent: phase.transfer_data.amount_percent } : {}) } } : {}),
    ...(phase.trial_end ? { trial_end: phase.trial_end } : {}),
    proration_behavior: phase.proration_behavior || 'none',
  };
}

function stateOf(subscription: Stripe.Subscription, schedule: Stripe.SubscriptionSchedule | null, ready: boolean, userId: string): BillingIntervalState {
  const price = subscription.items.data[0]?.price;
  const renewsAt = stripeSubscriptionPeriodEnd(subscription)?.toISOString() || null;
  const next = schedule?.phases.find(phase => phase.start_date >= (stripeSubscriptionPeriodEnd(subscription)?.getTime() || 0) / 1_000);
  const nextPrice = next?.items[0]?.price;
  const pending = next?.metadata?.interval;
  const scheduledInterval = pending === 'monthly' || pending === 'annual' ? pending : typeof nextPrice === 'object' && nextPrice && 'recurring' in nextPrice ? intervalOf(nextPrice) : null;
  let reason: string | undefined;
  if (!ready) reason = 'billing_unavailable';
  else if (!subscriptionHasConfirmedAccess(subscription)) reason = 'subscription_not_current';
  else if (subscription.cancel_at_period_end || subscription.cancel_at) reason = 'cancellation_scheduled';
  else if (subscription.items.data.length !== 1 || subscription.items.data[0]?.quantity !== 1 || price?.recurring?.usage_type !== 'licensed' || !intervalOf(price)) reason = 'unsupported_subscription';
  else if (subscription.pause_collection || subscription.pending_update) reason = 'subscription_change_pending';
  else if (schedule && (schedule.metadata?.managedBy !== MANAGED_SCHEDULE || schedule.metadata.userId !== userId)) reason = 'schedule_managed_elsewhere';
  return {
    canChange: !reason, currentInterval: price ? intervalOf(price) : null,
    currentPrice: typeof price?.unit_amount === 'number' ? { amount: price.unit_amount / 100, currency: price.currency.toUpperCase() } : null,
    renewsAt, scheduled: next && scheduledInterval ? { interval: scheduledInterval, effectiveAt: new Date(next.start_date * 1_000).toISOString() } : null,
    ...(reason ? { reason } : {}),
  };
}

async function ownedSubscription(userId: string, database = db) {
  const [user] = await database.select({ id: users.id, customerId: users.stripeCustomerId, subscriptionId: users.stripeSubscriptionId, isGuest: users.isGuest, accountStatus: users.accountStatus }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.isGuest || user.accountStatus !== 'active' || !user.subscriptionId || !user.customerId) throw new BillingError('subscription_missing', 'Esta cuenta no tiene una suscripción Stripe.', 404);
  const subscription = await retrieveCurrentStripeSubscription(user.subscriptionId);
  if (id(subscription.customer) !== user.customerId || (subscription.metadata.userId && subscription.metadata.userId !== user.id)) throw new BillingError('subscription_forbidden', 'La suscripción no pertenece a esta cuenta.', 403);
  return subscription;
}

export async function getBillingIntervalState(userId: string): Promise<BillingIntervalState> {
  if (!STRIPE_SECRET_KEY) throw new BillingError('billing_unavailable', 'Facturación no disponible.', 503);
  const subscription = await ownedSubscription(userId);
  const schedule = id(subscription.schedule) ? await stripe.subscriptionSchedules.retrieve(id(subscription.schedule)!, { expand: ['phases.items.price'] }) : null;
  return stateOf(subscription, schedule, isMonetizationEnabled() && await isBillingPortalReady(), userId);
}

export async function scheduleBillingInterval(input: { userId: string; interval: BillingInterval; requestId: string }): Promise<BillingIntervalState> {
  if (!STRIPE_SECRET_KEY || !isMonetizationEnabled() || !await isBillingPortalReady()) throw new BillingError('billing_unavailable', 'El cambio de periodicidad aún no está disponible.', 503);
  const targetPrice = (await getBillingPrices())[input.interval];
  if (!targetPrice) throw new BillingError('price_unavailable', 'Esta modalidad aún no está disponible.', 503);
  return db.transaction(async tx => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext(${`billing:${input.userId}`})) as locked`);
    if (!(lock.rows[0] as { locked?: boolean })?.locked) throw new BillingError('checkout_in_progress', 'Hay otra operación de facturación en curso. Vuelve a intentarlo.', 409);
    const subscription = await ownedSubscription(input.userId, tx as typeof db);
    let schedule = id(subscription.schedule) ? await stripe.subscriptionSchedules.retrieve(id(subscription.schedule)!, { expand: ['phases.items.price'] }) : null;
    // Recover a successful create whose response was lost without adopting somebody else's schedule.
    if (schedule && !schedule.metadata?.managedBy && schedule.phases.length === 1) {
      try {
        const created = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }, { idempotencyKey: `matchply-schedule-create:${input.userId}:${subscription.id}:${input.requestId}` });
        if (created.id === schedule.id) schedule.metadata = { managedBy: MANAGED_SCHEDULE, userId: input.userId };
      } catch { /* A foreign schedule remains protected by the ownership guard below. */ }
    }
    const state = stateOf(subscription, schedule, true, input.userId);
    if (!state.canChange) throw new BillingError(state.reason!, 'Esta suscripción debe gestionarse desde el portal de facturación.', 409);
    if (schedule?.metadata?.requestId === input.requestId) {
      if (schedule.metadata.pendingInterval !== input.interval) throw new BillingError('checkout_request_conflict', 'Esta solicitud ya pertenece a otra modalidad.', 409);
      return state;
    }
    if (state.scheduled?.interval === input.interval) return state;
    if (!schedule && state.currentInterval === input.interval) return state;
    if (!schedule) schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }, { idempotencyKey: `matchply-schedule-create:${input.userId}:${subscription.id}:${input.requestId}` });
    if (schedule.pause_schedules?.length || schedule.phases.some(phase => phase.add_invoice_items?.length)) throw new BillingError('unsupported_subscription', 'La programación de esta suscripción necesita revisión en el portal.', 409);
    const current = schedule.phases.find(phase => phase.start_date === schedule.current_phase?.start_date);
    const periodEnd = stripeSubscriptionPeriodEnd(subscription);
    if (!current || !periodEnd || periodEnd.getTime() <= Date.now()) throw new BillingError('subscription_not_current', 'La renovación de esta suscripción debe confirmarse primero.', 409);
    const currentPhase = preserveSchedulePhase(current);
    currentPhase.end_date = Math.floor(periodEnd.getTime() / 1_000);
    currentPhase.proration_behavior = 'none';
    // The current phase keeps its actual legacy Price and exact existing trial end.
    if (subscription.status === 'trialing' && subscription.trial_end) currentPhase.trial_end = subscription.trial_end;
    const nextPhase: Stripe.SubscriptionScheduleUpdateParams.Phase = { ...currentPhase,
      start_date: Math.floor(periodEnd.getTime() / 1_000), end_date: undefined,
      duration: { interval: input.interval === 'annual' ? 'year' : 'month', interval_count: 1 },
      items: currentPhase.items.map(item => ({ ...item, price: targetPrice.id })), trial_end: undefined,
      billing_cycle_anchor: 'phase_start', metadata: { ...subscription.metadata, interval: input.interval }, proration_behavior: 'none',
    };
    const updated = await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release', proration_behavior: 'none',
      phases: state.currentInterval === input.interval ? [currentPhase] : [currentPhase, nextPhase],
      metadata: { managedBy: MANAGED_SCHEDULE, userId: input.userId, requestId: input.requestId, pendingInterval: input.interval },
    }, { idempotencyKey: `matchply-schedule-update:${input.userId}:${subscription.id}:${input.requestId}` });
    return stateOf(subscription, updated, true, input.userId);
  });
}
