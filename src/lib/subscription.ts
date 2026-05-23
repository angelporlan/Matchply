export const PRO_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

export function isProSubscription(status: string | null | undefined) {
  return PRO_SUBSCRIPTION_STATUSES.has(status || '');
}
