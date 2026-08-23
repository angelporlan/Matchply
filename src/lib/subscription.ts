export const PRO_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export const FREE_USER_MAX_CVS = 1;
export const GUEST_MAX_CVS = 3;
export const HARVARD_TEMPLATE = 'harvard';
export const PREMIUM_CV_TEMPLATES = ['modern', 'minimal', 'creative', 'swiss'] as const;
export const ALL_CV_TEMPLATES = [HARVARD_TEMPLATE, ...PREMIUM_CV_TEMPLATES] as const;

export type AccessTier = 'guest' | 'free' | 'pro';
export type SubscriptionFeature =
  | 'advancedAi'
  | 'premiumTemplates'
  | 'star'
  | 'kanban'
  | 'apiKeys'
  | 'linkedinExtension'
  | 'deepResearch';

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
      premiumTemplates: false,
      star: false,
      kanban: false,
      apiKeys: false,
      linkedinExtension: false,
      deepResearch: false,
    },
  },
  free: {
    maxCvs: FREE_USER_MAX_CVS,
    templates: [HARVARD_TEMPLATE],
    features: {
      advancedAi: false,
      premiumTemplates: false,
      star: false,
      kanban: false,
      apiKeys: false,
      linkedinExtension: false,
      deepResearch: false,
    },
  },
  pro: {
    maxCvs: null,
    templates: ALL_CV_TEMPLATES,
    features: {
      advancedAi: true,
      premiumTemplates: true,
      star: true,
      kanban: true,
      apiKeys: true,
      linkedinExtension: true,
      deepResearch: true,
    },
  },
};

type EntitlementContext = {
  isGuest?: boolean;
};

export function isProSubscription(status: string | null | undefined) {
  return PRO_SUBSCRIPTION_STATUSES.has(status || '');
}

export function getAccessTier(
  status: string | null | undefined,
  context: EntitlementContext = {},
): AccessTier {
  if (context.isGuest) return 'guest';
  return isProSubscription(status) ? 'pro' : 'free';
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
