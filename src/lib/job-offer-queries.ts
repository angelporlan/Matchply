import { companies, companyNotes, cvs, jobOffers, users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { MATCH_PROMPT_VERSION } from '@/lib/matching/types';

// Only a current, versioned match is presented as a percentage. Keep stale
// values stored for recovery, without shipping evidence into list payloads.
export const currentMatchScore = sql<number | null>`case when ${jobOffers.matchInputHash} is not null
  and ${jobOffers.matchEvidence}->>'version' = ${MATCH_PROMPT_VERSION}
  and ${jobOffers.matchEvidence}->>'inputHash' = ${jobOffers.matchInputHash}
  then ${jobOffers.scoreOverall} else null end`;

export const applicationSummaryColumns = {
  id: jobOffers.id,
  userId: jobOffers.userId,
  cvId: jobOffers.cvId,
  title: jobOffers.title,
  company: jobOffers.company,
  companyId: jobOffers.companyId,
  url: jobOffers.url,
  platform: jobOffers.platform,
  status: jobOffers.status,
  scoreOverall: currentMatchScore,
  tldr: jobOffers.tldr,
  legitimacyTier: jobOffers.legitimacyTier,
  livenessStatus: jobOffers.livenessStatus,
  nextFollowupDate: jobOffers.nextFollowupDate,
  source: jobOffers.source,
  createdAt: jobOffers.createdAt,
  updatedAt: jobOffers.updatedAt,
};

// Ownership / mutation checks on job_offer: never pull description, rawReport,
// cover letters or JSONB just to verify the owner or log an audit entry.
export const jobOfferOwnershipColumns = {
  id: jobOffers.id,
  userId: jobOffers.userId,
  cvId: jobOffers.cvId,
  title: jobOffers.title,
  company: jobOffers.company,
  companyId: jobOffers.companyId,
  status: jobOffers.status,
  url: jobOffers.url,
  externalSource: jobOffers.externalSource,
  externalId: jobOffers.externalId,
  sourceMetadata: jobOffers.sourceMetadata,
  nextFollowupDate: jobOffers.nextFollowupDate,
};

// CV metadata for rename/style/delete/principal flows (no markdown content).
export const cvMetaColumns = {
  id: cvs.id,
  userId: cvs.userId,
  title: cvs.title,
  isBase: cvs.isBase,
  isPrincipal: cvs.isPrincipal,
  templateName: cvs.templateName,
  accentColor: cvs.accentColor,
  fontFamily: cvs.fontFamily,
  pageMargin: cvs.pageMargin,
  scale: cvs.scale,
  createdAt: cvs.createdAt,
  updatedAt: cvs.updatedAt,
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
  updatedAt: cvs.updatedAt,
};

export const cvTargetColumns = {
  cvId: jobOffers.cvId,
  title: jobOffers.title,
  company: jobOffers.company,
  scoreOverall: currentMatchScore,
};

export const curateOfferColumns = {
  id: jobOffers.id,
  title: jobOffers.title,
  company: jobOffers.company,
  description: jobOffers.description,
  platform: jobOffers.platform,
  scoreOverall: jobOffers.scoreOverall,
  scoreBreakdown: jobOffers.scoreBreakdown,
  tldr: jobOffers.tldr,
  sourceMetadata: jobOffers.sourceMetadata,
  matchInputHash: jobOffers.matchInputHash,
  matchKind: jobOffers.matchKind,
  matchEvidence: jobOffers.matchEvidence,
  matchDetails: jobOffers.matchDetails,
  matchEvaluatedAt: jobOffers.matchEvaluatedAt,
};

export const companyListColumns = {
  id: companies.id,
  userId: companies.userId,
  name: companies.name,
  website: companies.website,
  location: companies.location,
  sector: companies.sector,
  createdAt: companies.createdAt,
  updatedAt: companies.updatedAt,
};

export const companyLookupColumns = {
  id: companies.id,
  name: companies.name,
};

export const companyNoteColumns = {
  id: companyNotes.id,
  companyId: companyNotes.companyId,
  content: companyNotes.content,
  createdAt: companyNotes.createdAt,
  updatedAt: companyNotes.updatedAt,
};

export type ApplicationSummary = {
  id: string;
  userId: string;
  cvId: string | null;
  title: string;
  company: string;
  companyId: string | null;
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
  updatedAt: Date;
};

export type CvTargetSummary = {
  cvId: string | null;
  title: string;
  company: string;
  scoreOverall: number | null;
};

export type CompanyListItem = {
  id: string;
  userId: string;
  name: string;
  website: string | null;
  location: string | null;
  sector: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyLookupItem = {
  id: string;
  name: string;
};

export type CompanyNoteItem = {
  id: string;
  companyId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CompanyListRow = CompanyListItem & {
  applicationCount: number;
  noteCount: number;
};
