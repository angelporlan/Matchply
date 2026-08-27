import { createAuditLog } from '@/lib/audit';
import { upsertExternalApplication } from '@/lib/application-service';
import { markExtensionCapture } from '@/lib/extension-auth';
import { enqueueResearchForOffer } from '@/lib/research/queue';
import { ResearchStatus } from '@/lib/research/types';

const MAX_TITLE_LENGTH = 240;
const MAX_COMPANY_LENGTH = 240;
const MAX_LOCATION_LENGTH = 240;
const MAX_DESCRIPTION_LENGTH = 120_000;
const MAX_RAW_TEXT_LENGTH = 160_000;
const MAX_METADATA_LENGTH = 12_000;

export class ExtensionPayloadError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ExtensionPayloadError';
  }
}

export type LinkedInIngestPayload = {
  sourceJobId?: unknown;
  canonicalUrl?: unknown;
  title?: unknown;
  company?: unknown;
  location?: unknown;
  workplaceType?: unknown;
  employmentType?: unknown;
  description?: unknown;
  rawText?: unknown;
  sourceMetadata?: unknown;
};

function boundedText(value: unknown, field: string, maxLength: number, required = false) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ExtensionPayloadError(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new ExtensionPayloadError(`${field} must be a string`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ExtensionPayloadError(`${field} is required`);
  if (trimmed.length > maxLength) throw new ExtensionPayloadError(`${field} exceeds the allowed size`);
  return trimmed || null;
}

function canonicalLinkedInUrl(value: unknown) {
  const raw = boundedText(value, 'canonicalUrl', 2_000, true)!;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ExtensionPayloadError('canonicalUrl is not a valid URL');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || !(hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com'))) {
    throw new ExtensionPayloadError('canonicalUrl must be an HTTPS LinkedIn URL');
  }
  if (!parsed.pathname.toLowerCase().includes('/jobs/')) {
    throw new ExtensionPayloadError('canonicalUrl must point to a LinkedIn job');
  }
  parsed.hash = '';
  // Tracking query parameters would break idempotency. LinkedIn's job id is in the path.
  parsed.search = '';
  return parsed.toString();
}

function normalizeSourceMetadata(input: unknown, location: string | null, workplaceType: string | null, employmentType: string | null) {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const posterInput = source.poster && typeof source.poster === 'object'
    ? source.poster as Record<string, unknown>
    : null;
  const profileUrlValue = boundedText(posterInput?.profileUrl, 'sourceMetadata.poster.profileUrl', 1_000);
  if (profileUrlValue) {
    let profileUrl: URL;
    try { profileUrl = new URL(profileUrlValue); } catch { throw new ExtensionPayloadError('sourceMetadata.poster.profileUrl is invalid'); }
    const profileHost = profileUrl.hostname.toLowerCase();
    if (profileUrl.protocol !== 'https:' || !(profileHost === 'linkedin.com' || profileHost.endsWith('.linkedin.com')) || !profileUrl.pathname.toLowerCase().includes('/in/')) {
      throw new ExtensionPayloadError('sourceMetadata.poster.profileUrl must be a LinkedIn professional URL');
    }
  }
  const poster = posterInput ? {
    name: boundedText(posterInput.name, 'sourceMetadata.poster.name', 180),
    role: boundedText(posterInput.role, 'sourceMetadata.poster.role', 240),
    profileUrl: profileUrlValue,
  } : null;
  const metadata = {
    payloadVersion: 1,
    location,
    workplaceType,
    employmentType,
    salaryVisible: boundedText(source.salaryVisible, 'sourceMetadata.salaryVisible', 240),
    postedAt: boundedText(source.postedAt, 'sourceMetadata.postedAt', 120),
    poster,
  };
  if (JSON.stringify(metadata).length > MAX_METADATA_LENGTH) {
    throw new ExtensionPayloadError('sourceMetadata exceeds the allowed size');
  }
  return metadata;
}

function normalizeSourceJobId(value: unknown) {
  const sourceJobId = boundedText(value, 'sourceJobId', 128, true)!;
  if (!/^[A-Za-z0-9_-]+$/.test(sourceJobId)) {
    throw new ExtensionPayloadError('sourceJobId contains invalid characters');
  }
  return sourceJobId;
}

export async function ingestLinkedInOffer(
  userId: string,
  installationId: string,
  input: LinkedInIngestPayload,
) {
  const sourceJobId = normalizeSourceJobId(input.sourceJobId);
  const canonicalUrl = canonicalLinkedInUrl(input.canonicalUrl);
  const title = boundedText(input.title, 'title', MAX_TITLE_LENGTH, true)!;
  const company = boundedText(input.company, 'company', MAX_COMPANY_LENGTH, true)!;
  const location = boundedText(input.location, 'location', MAX_LOCATION_LENGTH);
  const workplaceType = boundedText(input.workplaceType, 'workplaceType', 120);
  const employmentType = boundedText(input.employmentType, 'employmentType', 120);
  const description = boundedText(input.description, 'description', MAX_DESCRIPTION_LENGTH);
  const rawText = boundedText(input.rawText, 'rawText', MAX_RAW_TEXT_LENGTH);
  const sourceMetadata = normalizeSourceMetadata(input.sourceMetadata, location, workplaceType, employmentType);

  const { offer, created } = await upsertExternalApplication(userId, {
    title,
    company,
    url: canonicalUrl,
    platform: 'linkedin',
    source: 'linkedin_extension',
    externalSource: 'linkedin',
    externalId: sourceJobId,
    description: description || rawText || undefined,
    sourceMetadata,
    status: 'interested',
  });

  await markExtensionCapture(installationId);
  await createAuditLog(created ? 'extension_job_capture_create' : 'extension_job_capture_update', userId, null, {
    offerId: offer.id,
    sourceJobId,
  });

  return {
    success: true,
    created,
    application: { id: offer.id },
  };
}
