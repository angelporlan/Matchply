export type OfferPlatform = 'linkedin' | 'infojobs' | 'indeed' | 'other';
export type OfferImportStage = 'reading' | 'searching' | 'structuring';
export type ImportedOffer = {
  jobTitle: string;
  company: string;
  jobDescription: string;
  url: string;
  platform: OfferPlatform;
  sourceMethod: 'direct' | 'web_search' | 'manual';
  sources: string[];
};

export function offerPlatform(rawUrl: string): OfferPlatform {
  let host: string;
  try { host = new URL(rawUrl).hostname.toLowerCase(); } catch { return 'other'; }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
  if (host === 'infojobs.net' || host.endsWith('.infojobs.net')) return 'infojobs';
  if (host === 'indeed.com' || host.endsWith('.indeed.com') || host === 'indeed.es' || host.endsWith('.indeed.es')) return 'indeed';
  return 'other';
}

export function linkedInJobId(rawUrl: string): string | null {
  if (offerPlatform(rawUrl) !== 'linkedin') return null;
  return new URL(rawUrl).pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d+)\/?$/)?.[1] || null;
}

/** Keep functional query parameters on other portals. */
export function normalizeOfferUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      (url.port && !['80', '443'].includes(url.port))) throw new Error('OFFER_URL_INVALID');
  url.hash = '';
  const jobId = linkedInJobId(url.toString());
  if (offerPlatform(url.toString()) === 'linkedin') {
    if (!jobId) throw new Error('OFFER_URL_INVALID');
    return `https://www.linkedin.com/jobs/view/${jobId}/`;
  }
  return url.toString();
}

export function sameOfferUrl(candidate: string, expected: string): boolean {
  try {
    const normalizedCandidate = normalizeOfferUrl(candidate);
    const normalizedExpected = normalizeOfferUrl(expected);
    const id = linkedInJobId(normalizedExpected);
    return id ? linkedInJobId(normalizedCandidate) === id : normalizedCandidate === normalizedExpected;
  } catch { return false; }
}

export function usableOfferDescription(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 80 && value.length <= 120_000;
}
