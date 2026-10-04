export const LANDING_EXPERIMENT_ID = 'landing_headline_v1';
export const LANDING_EXPERIMENT_COOKIE_NAME = 'matchply_landing_headline';
export const LANDING_EXPERIMENT_HEADER_NAME = 'x-matchply-landing-variant';
export const LANDING_EXPERIMENT_MAX_AGE = 7 * 24 * 60 * 60;
export const DEFAULT_LANDING_VARIANT = 'A' as const;

export type LandingVariant = 'A' | 'B';
export type LandingExperiment = { variant: LandingVariant | null; enabled: boolean };
export type LandingExperimentStage = 'exposed' | 'cta' | 'first_pdf' | 'signup';

export function parseLandingExperimentValue(value: string | null | undefined): LandingVariant | null {
  if (value === 'v1:A') return 'A';
  if (value === 'v1:B') return 'B';
  return null;
}

export function serializeLandingExperimentVariant(variant: LandingVariant) {
  return `v1:${variant}`;
}

export function chooseLandingVariant(random: number): LandingVariant {
  return random < 0.5 ? 'A' : 'B';
}

export function isLandingPrefetch(headers: Pick<Headers, 'get'>) {
  return headers.get('next-router-prefetch') !== null
    || /prefetch/i.test(headers.get('purpose') || '')
    || /prefetch/i.test(headers.get('sec-purpose') || '');
}

export function hasAuthSessionCookie(cookies: ReadonlyArray<{ name: string }>) {
  return cookies.some((cookie) => /^(?:__Secure-)?authjs\.session-token(?:\.\d+)?$/.test(cookie.name));
}

export function resolveLandingExperiment(input: {
  headerValue?: string | null;
  cookieValue?: string | null;
  enabled: boolean;
}): LandingExperiment {
  const variant = input.enabled
    ? parseLandingExperimentValue(input.headerValue) || parseLandingExperimentValue(input.cookieValue)
    : null;
  return { variant, enabled: input.enabled && variant !== null };
}

export function landingExperimentEvent(variant: LandingVariant, stage: LandingExperimentStage) {
  return `${LANDING_EXPERIMENT_ID}_${variant.toLowerCase()}_${stage}`;
}

export function landingExperimentStorageKey(variant: LandingVariant, stage: LandingExperimentStage) {
  return `matchply:${landingExperimentEvent(variant, stage)}`;
}
