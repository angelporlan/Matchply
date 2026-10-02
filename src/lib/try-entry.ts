export type TryGate =
  | { kind: 'redirect'; href: '/api/guest?redirect=/try' | '/dashboard' }
  | { kind: 'entry' };

/** Guests with no draft stay on the single adapt screen. Anyone with a CV or candidacy goes to the dashboard. */
export function resolveTryGate(input: {
  hasViewer: boolean;
  cvCount: number;
  offerCount: number;
}): TryGate {
  if (!input.hasViewer) return { kind: 'redirect', href: '/api/guest?redirect=/try' };
  if (input.cvCount > 0 || input.offerCount > 0) return { kind: 'redirect', href: '/dashboard' };
  return { kind: 'entry' };
}

/** A direct /register with no account and no guest draft starts activation instead of an empty dashboard. */
export function coldRegisterDestination(input: {
  hasSession: boolean;
  hasGuestCookie: boolean;
}): '/try' | null {
  if (input.hasSession || input.hasGuestCookie) return null;
  return '/try';
}

/** Keep a heading so the PDF template has a title when the paste is plain text. */
export function trialCvMarkdown(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('#')) return trimmed;
  return `# CV\n\n${trimmed}`;
}
