import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';

/** Matchply's Nginx overwrites X-Real-IP and appends the peer to X-Forwarded-For. */
export function trustedClientIp(request: { headers: { get(name: string): string | null } }): string {
  const real = request.headers.get('x-real-ip')?.trim();
  const forwarded = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  for (const candidate of [real, forwarded]) {
    if (candidate && isIP(candidate)) return ipaddr.process(candidate).toString();
  }
  return 'unknown';
}

export function clientIpKey(request: { headers: { get(name: string): string | null } }): string {
  return createHash('sha256').update(trustedClientIp(request)).digest('hex');
}
