import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getRequestContext, requireAdminContext } from '@/lib/request-context';

export function isGtmViewerEnabled() {
  return process.env.GTM_VIEWER_ENABLED === 'true';
}

export function localHostname(hostHeader: string | null) {
  const value = (hostHeader || '').trim().toLowerCase().replace(/\.$/, '');
  if (value.startsWith('[')) {
    const closingBracket = value.indexOf(']');
    return closingBracket >= 0 ? value.slice(0, closingBracket + 1) : value;
  }
  const lastColon = value.lastIndexOf(':');
  return lastColon > 0 && value.indexOf(':') === lastColon ? value.slice(0, lastColon) : value;
}

export function isLocalGtmHost(hostHeader: string | null) {
  const hostname = localHostname(hostHeader);
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

export function isGtmViewerAvailable(hostHeader: string | null) {
  return isGtmViewerEnabled() && isLocalGtmHost(hostHeader);
}

export async function requireGtmPageAccess() {
  if (!isGtmViewerAvailable(headers().get('host'))) notFound();

  const context = await getRequestContext();
  if (!context.realUser) {
    redirect('/login?callbackUrl=%2Fgtm');
  }

  try {
    const { admin } = await requireAdminContext();
    return admin;
  } catch {
    redirect('/dashboard');
  }
}
