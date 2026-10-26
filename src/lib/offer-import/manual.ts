import { resolveOfferIdentity } from '@/lib/offer-fields';
import { normalizeOfferUrl, offerPlatform, usableOfferDescription, type ImportedOffer } from './types';

export function manualOffer(description: string, rawUrl = ''): ImportedOffer | null {
  if (!usableOfferDescription(description)) return null;
  let url = '';
  // Pasted text is the source. An optional link must never make that source unusable.
  try { if (rawUrl.trim()) url = normalizeOfferUrl(rawUrl); } catch { /* Keep the text-only offer. */ }
  return { ...resolveOfferIdentity({ jobDescription: description }), jobDescription: description.trim(),
    url, platform: offerPlatform(url), sourceMethod: 'manual', sources: [] };
}
