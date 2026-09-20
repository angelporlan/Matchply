export function isImpersonationEnabled() {
  return process.env.IMPERSONATION_ENABLED === 'true';
}

export function isUmamiCollectionEnabled() {
  return (
    process.env.NODE_ENV === 'production'
    && process.env.UMAMI_ENABLED === 'true'
    && process.env.UMAMI_AEPD_CLEARED === 'true'
    && Boolean(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || process.env.UMAMI_WEBSITE_ID)
  );
}

export function isUmamiAdminEnabled() {
  return Boolean(
    process.env.UMAMI_API_URL
    && process.env.UMAMI_API_TOKEN
    && (process.env.UMAMI_WEBSITE_ID || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID),
  );
}
