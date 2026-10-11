export const PRO_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export const FREE_USER_MAX_CVS = 3;
export const GUEST_MAX_CVS = 3;
export const GUEST_MAX_PDF_DOWNLOADS = 1;
export const HARVARD_TEMPLATE = 'harvard';
export const ALL_CV_TEMPLATES = [HARVARD_TEMPLATE] as const;

export type AccessTier = 'guest' | 'free' | 'pro';
export type SubscriptionFeature =
  | 'advancedAi'
  | 'networking'
  | 'applications'
  | 'linkedinExtension'
  | 'deepResearch'
  | 'agentApi';

type PlanEntitlements = {
  maxCvs: number | null;
  templates: readonly string[];
  features: Record<SubscriptionFeature, boolean>;
};

export const PLAN_ENTITLEMENTS: Record<AccessTier, PlanEntitlements> = {
  guest: {
    maxCvs: GUEST_MAX_CVS,
    templates: [HARVARD_TEMPLATE],
    features: {
      advancedAi: false,
      networking: true,
      applications: true,
      linkedinExtension: false,
      deepResearch: false,
      agentApi: false,
    },
  },
  free: {
    maxCvs: FREE_USER_MAX_CVS,
    templates: [HARVARD_TEMPLATE],
    features: {
      advancedAi: false,
      networking: true,
      applications: true,
      linkedinExtension: true,
      deepResearch: false,
      agentApi: false,
    },
  },
  pro: {
    maxCvs: null,
    templates: ALL_CV_TEMPLATES,
    features: {
      advancedAi: true,
      networking: true,
      applications: true,
      linkedinExtension: true,
      deepResearch: true,
      agentApi: true,
    },
  },
};

export type EntitlementContext = {
  isGuest?: boolean;
  proGrantedUntil?: Date | string | null;
  now?: Date;
  stripePriceId?: string | null;
  stripePaidAt?: Date | null;
  stripeCurrentPeriodEnd?: Date | null;
  stripeTrialEnd?: Date | null;
};
export function hasCurrentStripeAccess(status: string | null | undefined, context: EntitlementContext = {}) {
  if (!isProSubscription(status)) return false;
  // Existing subscriptions retain access until their first authoritative reconciliation.
  if (!context.stripePriceId) return true;
  const now = context.now ?? new Date();
  if (status === 'trialing') return Boolean(context.stripeTrialEnd && new Date(context.stripeTrialEnd) > now);
  return Boolean(context.stripePaidAt && context.stripeCurrentPeriodEnd && new Date(context.stripeCurrentPeriodEnd) > now);
}

export function isProSubscription(status: string | null | undefined) {
  return PRO_SUBSCRIPTION_STATUSES.has(status || '');
}

export function isProGrantActive(
  proGrantedUntil?: Date | string | null,
  now: Date = new Date(),
) {
  if (!proGrantedUntil) return false;
  const until = proGrantedUntil instanceof Date ? proGrantedUntil : new Date(proGrantedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

export function hasProAccess(user: {
  subscriptionStatus?: string | null;
  proGrantedUntil?: Date | string | null;
  isGuest?: boolean;
  now?: Date;
  stripePriceId?: string | null;
  stripePaidAt?: Date | null;
  stripeCurrentPeriodEnd?: Date | null;
  stripeTrialEnd?: Date | null;
}) {
  if (user.isGuest) return false;
  if (hasCurrentStripeAccess(user.subscriptionStatus, user)) return true;
  return isProGrantActive(user.proGrantedUntil, user.now);
}

export type EffectivePlanSource = 'stripe' | 'trialing' | 'granted' | 'free' | 'guest';

export function getEffectivePlanSource(user: EntitlementContext & { subscriptionStatus?: string | null }): EffectivePlanSource {
  if (user.isGuest) return 'guest';
  const status = user.subscriptionStatus || 'none';
  if (hasCurrentStripeAccess(status, user)) return status === 'trialing' ? 'trialing' : 'stripe';
  if (isProGrantActive(user.proGrantedUntil, user.now)) return 'granted';
  return 'free';
}

export function getAccessTier(
  status: string | null | undefined,
  context: EntitlementContext = {},
): AccessTier {
  if (context.isGuest) return 'guest';
  if (hasCurrentStripeAccess(status, context) || isProGrantActive(context.proGrantedUntil, context.now)) return 'pro';
  return 'free';
}

export function effectiveSubscriptionStatus(user: EntitlementContext & { subscriptionStatus?: string | null }) {
  return hasProAccess(user) ? 'active' : 'none';
}

export function userEntitlements(user: EntitlementContext): EntitlementContext {
  return { ...user, isGuest: Boolean(user.isGuest), proGrantedUntil: user.proGrantedUntil ?? null };
}

export function getPlanEntitlements(
  status: string | null | undefined,
  context: EntitlementContext = {},
) {
  return PLAN_ENTITLEMENTS[getAccessTier(status, context)];
}

export function canCreateCv(
  status: string | null | undefined,
  currentCvCount: number,
  context: EntitlementContext = {},
) {
  const { maxCvs } = getPlanEntitlements(status, context);
  return maxCvs === null || currentCvCount < maxCvs;
}

export function canUseCvTemplate(
  status: string | null | undefined,
  templateName: string | null | undefined,
  context: EntitlementContext = {},
) {
  if (!templateName) return false;
  return getPlanEntitlements(status, context).templates.includes(templateName);
}

export function getAllowedCvTemplate(
  status: string | null | undefined,
  templateName: string | null | undefined,
  context: EntitlementContext = {},
) {
  return canUseCvTemplate(status, templateName, context)
    ? templateName as string
    : HARVARD_TEMPLATE;
}

export function canAccessFeature(
  status: string | null | undefined,
  feature: SubscriptionFeature,
  context: EntitlementContext = {},
) {
  return getPlanEntitlements(status, context).features[feature];
}

export function canGuestDownloadPdf(usedCount: number) {
  return usedCount < GUEST_MAX_PDF_DOWNLOADS;
}
