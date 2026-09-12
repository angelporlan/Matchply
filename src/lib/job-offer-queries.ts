import { cvs, jobOffers, users } from '@/db/schema';

export const applicationSummaryColumns = {
  id: jobOffers.id,
  userId: jobOffers.userId,
  cvId: jobOffers.cvId,
  title: jobOffers.title,
  company: jobOffers.company,
  url: jobOffers.url,
  platform: jobOffers.platform,
  status: jobOffers.status,
  scoreOverall: jobOffers.scoreOverall,
  tldr: jobOffers.tldr,
  legitimacyTier: jobOffers.legitimacyTier,
  livenessStatus: jobOffers.livenessStatus,
  nextFollowupDate: jobOffers.nextFollowupDate,
  source: jobOffers.source,
  createdAt: jobOffers.createdAt,
  updatedAt: jobOffers.updatedAt,
};

export const sessionUserColumns = {
  id: users.id,
  name: users.name,
  email: users.email,
  image: users.image,
  role: users.role,
  subscriptionStatus: users.subscriptionStatus,
};

export const baseCvForAiColumns = {
  id: cvs.id,
  title: cvs.title,
  content: cvs.content,
  isBase: cvs.isBase,
  isPrincipal: cvs.isPrincipal,
};

export const cvListColumns = {
  id: cvs.id,
  title: cvs.title,
  isBase: cvs.isBase,
  isPrincipal: cvs.isPrincipal,
  templateName: cvs.templateName,
  accentColor: cvs.accentColor,
  createdAt: cvs.createdAt,
};

export const curateOfferColumns = {
  id: jobOffers.id,
  title: jobOffers.title,
  company: jobOffers.company,
  description: jobOffers.description,
  platform: jobOffers.platform,
  scoreOverall: jobOffers.scoreOverall,
  tldr: jobOffers.tldr,
  sourceMetadata: jobOffers.sourceMetadata,
};

export type ApplicationSummary = {
  id: string;
  userId: string;
  cvId: string | null;
  title: string;
  company: string;
  url: string | null;
  platform: string;
  status: string;
  scoreOverall: number | null;
  tldr: string | null;
  legitimacyTier: string | null;
  livenessStatus: string | null;
  nextFollowupDate: Date | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CvListItem = {
  id: string;
  title: string;
  isBase: boolean;
  isPrincipal: boolean;
  templateName: string;
  accentColor: string | null;
  createdAt: Date;
};
