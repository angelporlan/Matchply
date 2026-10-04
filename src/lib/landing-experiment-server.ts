import { cookies, headers } from 'next/headers';
import { isUmamiCollectionEnabled } from '@/lib/flags';
import { getRequestContext } from '@/lib/request-context';
import { isUmamiDoNotTrack } from '@/lib/umami';
import {
  LANDING_EXPERIMENT_COOKIE_NAME,
  LANDING_EXPERIMENT_HEADER_NAME,
  resolveLandingExperiment,
} from '@/lib/landing-experiment';

/** Shared by the landing SSR and the persistent analytics chrome. */
export async function readLandingExperiment() {
  const ctx = await getRequestContext();
  const requestHeaders = headers();
  const enabled = isUmamiCollectionEnabled() && Boolean(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL)
    && !isUmamiDoNotTrack(requestHeaders.get('dnt'))
    && ctx.realUser?.role !== 'admin' && !ctx.impersonation && !ctx.impersonationInvalid;
  return resolveLandingExperiment({
    // Prefetch must retain an existing assignment in the serialized page. It cannot
    // assign (middleware) or expose (the beacon requires a visible, hydrated page).
    enabled,
    headerValue: requestHeaders.get(LANDING_EXPERIMENT_HEADER_NAME),
    cookieValue: cookies().get(LANDING_EXPERIMENT_COOKIE_NAME)?.value,
  });
}
