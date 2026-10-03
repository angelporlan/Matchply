/** Default post-claim path when the visitor did not ask for a specific next URL. */
export const DEFAULT_CLAIM_NEXT = '/dashboard';

export function isDefaultClaimNext(nextPath: string): boolean {
  try {
    const parsed = new URL(nextPath, 'https://matchply.internal');
    return parsed.origin === 'https://matchply.internal'
      && parsed.pathname === DEFAULT_CLAIM_NEXT
      && parsed.search === ''
      && parsed.hash === '';
  } catch {
    return false;
  }
}

/**
 * After a successful claim, a plain /dashboard next opens the adapted CV.
 * A claim with no CV opens the activation screen. Any other next (checkout, a
 * chosen page) is kept. A failed claim stays on next.
 */
export function resolveClaimRedirect(input: {
  claimed: boolean;
  cvId: string | null;
  nextPath: string;
}): string {
  if (!input.claimed) return input.nextPath;
  if (!isDefaultClaimNext(input.nextPath)) return input.nextPath;
  if (!input.cvId) return '/try';
  return `/editor/${input.cvId}`;
}
