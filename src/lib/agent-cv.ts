import { jobOffers } from '@/db/schema';

export const AGENT_CV_OFFER_COLUMNS = {
  id: jobOffers.id,
  title: jobOffers.title,
  company: jobOffers.company,
  description: jobOffers.description,
  url: jobOffers.url,
  platform: jobOffers.platform,
  cvId: jobOffers.cvId,
};

export function agentCvAdmissionError(offer: { description: string | null } | null): 'not_found' | 'offer_description_required' | null {
  if (!offer) return 'not_found';
  if (!offer.description?.trim()) return 'offer_description_required';
  return null;
}
