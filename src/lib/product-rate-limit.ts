import { clientIpKey } from '@/lib/client-ip';
import { NextResponse } from 'next/server';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { publicErrorBody } from '@/lib/public-errors';

type Policy = { session: number; ip: number; windowMs: number; sessionPrefix: string };
const tenMinutes = 10 * 60_000, minute = 60_000;
export const PRODUCT_RATE_POLICIES = {
  guest: { session: 30, ip: 60, windowMs: tenMinutes, sessionPrefix: 'guest:init' },
  optimize: { session: 8, ip: 40, windowMs: tenMinutes, sessionPrefix: 'ai:optimize' },
  offerImport: { session: 8, ip: 40, windowMs: tenMinutes, sessionPrefix: 'ai:offer-import' },
  discovery: { session: 3, ip: 24, windowMs: tenMinutes, sessionPrefix: 'ai:discovery' },
  curate: { session: 10, ip: 50, windowMs: tenMinutes, sessionPrefix: 'ai:curate' },
  cvImport: { session: 8, ip: 40, windowMs: tenMinutes, sessionPrefix: 'ai:import' },
  parsePdf: { session: 12, ip: 60, windowMs: tenMinutes, sessionPrefix: 'cv:parse-pdf' },
  profileExtract: { session: 8, ip: 40, windowMs: tenMinutes, sessionPrefix: 'ai:profile-extract' },
  profileInterview: { session: 20, ip: 80, windowMs: tenMinutes, sessionPrefix: 'ai:profile-interview' },
  outreach: { session: 8, ip: 40, windowMs: tenMinutes, sessionPrefix: 'ai:outreach' },
  networking: { session: 6, ip: 30, windowMs: minute, sessionPrefix: 'networking' },
  research: { session: 8, ip: 40, windowMs: tenMinutes, sessionPrefix: 'ai:research' },
  singleMatch: { session: 10, ip: 50, windowMs: tenMinutes, sessionPrefix: 'ai:single-match' },
  adminProbe: { session: 6, ip: 30, windowMs: minute, sessionPrefix: 'ai:admin-probe' },
  cvPhoto: { session: 12, ip: 60, windowMs: minute, sessionPrefix: 'cv-photo' },
  profilePhoto: { session: 12, ip: 60, windowMs: minute, sessionPrefix: 'profile-photo' },
  personPhoto: { session: 12, ip: 60, windowMs: minute, sessionPrefix: 'person-photo' },
  extensionUpload: { session: 120, ip: 240, windowMs: minute, sessionPrefix: 'ext:upload' },
} satisfies Record<string, Policy>;
export type ProductRatePolicy = keyof typeof PRODUCT_RATE_POLICIES;

/** Called before authentication/body parsing; IPs are only retained as hashes. */
export function consumeProductIp(request: { headers: { get(name: string): string | null } }, kind: ProductRatePolicy) {
  const policy = PRODUCT_RATE_POLICIES[kind];
  const key = clientIpKey(request);
  consumeRateLimit(`product:ip:${kind}:${key}`, policy.ip, policy.windowMs);
}

/** Registered accounts and guests use their verified actor, not a caller-provided token. */
export function consumeProductSession(userId: string, kind: ProductRatePolicy) {
  const policy = PRODUCT_RATE_POLICIES[kind];
  consumeRateLimit(`${policy.sessionPrefix}:${userId}`, policy.session, policy.windowMs);
}

export function rateLimitResponse(error: RateLimitError) {
  return NextResponse.json(publicErrorBody(error), { status: 429, headers: {
    'Cache-Control': 'no-store', 'Retry-After': String(error.retryAfterSeconds),
  } });
}

export function checkProductIp(request: { headers: { get(name: string): string | null } }, kind: ProductRatePolicy) {
  try { consumeProductIp(request, kind); return null; }
  catch (error) { if (error instanceof RateLimitError) return rateLimitResponse(error); throw error; }
}
