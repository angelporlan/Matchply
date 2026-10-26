import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validRequestId } from '@/lib/request-id';
import { diagnosticRoute } from '@/lib/diagnostics-schema';
import { isUmamiCollectionEnabled } from '@/lib/flags';
import { isUmamiDoNotTrack } from '@/lib/umami';
import {
  LANDING_EXPERIMENT_COOKIE_NAME,
  LANDING_EXPERIMENT_HEADER_NAME,
  LANDING_EXPERIMENT_MAX_AGE,
  chooseLandingVariant,
  hasAuthSessionCookie,
  isLandingPrefetch,
  parseLandingExperimentValue,
  serializeLandingExperimentVariant,
} from '@/lib/landing-experiment';

export function middleware(request: NextRequest) {
  const requestId = validRequestId(request.headers.get('x-request-id')) || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);
  requestHeaders.set('x-matchply-route', diagnosticRoute(request.nextUrl.pathname));
  requestHeaders.delete('x-matchply-blog-language');
  const blogLocale = request.nextUrl.pathname.match(/^\/blog\/(es|en)(?:\/|$)/)?.[1];
  if (blogLocale) requestHeaders.set('x-matchply-blog-language', blogLocale);
  // Never trust a visitor-supplied experiment assignment.
  requestHeaders.delete(LANDING_EXPERIMENT_HEADER_NAME);

  let newAssignment: string | null = null;
  const canAssign = request.nextUrl.pathname === '/' && request.method === 'GET'
    && isUmamiCollectionEnabled() && Boolean(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL)
    && !isUmamiDoNotTrack(request.headers.get('dnt')) && !isLandingPrefetch(request.headers)
    && !request.cookies.has('mp_support');
  if (canAssign) {
    const existing = parseLandingExperimentValue(request.cookies.get(LANDING_EXPERIMENT_COOKIE_NAME)?.value);
    // Guests use matchply_guest, independently of Auth.js account sessions.
    // Registered participants keep their assignment; SSR excludes admin accounts.
    if (existing || !hasAuthSessionCookie(request.cookies.getAll())) {
      const variant = existing || chooseLandingVariant(crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000);
      const value = serializeLandingExperimentVariant(variant);
      requestHeaders.set(LANDING_EXPERIMENT_HEADER_NAME, value);
      if (!existing) newAssignment = value;
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set('x-request-id', requestId);
  if (newAssignment) {
    response.cookies.set(LANDING_EXPERIMENT_COOKIE_NAME, newAssignment, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: LANDING_EXPERIMENT_MAX_AGE,
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets/).*)'],
};
