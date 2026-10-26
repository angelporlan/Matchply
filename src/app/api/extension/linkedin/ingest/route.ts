import { RateLimitError } from '@/lib/rate-limit';
import { consumeProductIp, consumeProductSession } from '@/lib/product-rate-limit';
import { log } from '@/lib/logger';
import { publicErrorBody } from '@/lib/public-errors';
import { NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { resolveExtensionSession, ExtensionAuthError, rateLimitExtensionRequest } from '@/lib/extension-auth';
import { extensionJson, extensionOptions } from '@/lib/extension-http';
import { ExtensionPayloadError, ingestLinkedInOffer } from '@/lib/extension-service';
import { requireUserFeature, SubscriptionAccessError } from '@/lib/permissions';

export async function OPTIONS() {
  return extensionOptions();
}

export async function POST(req: NextRequest) {
  try { consumeProductIp(req, 'extensionUpload'); }
  catch (error) { if (error instanceof RateLimitError) return extensionJson({ error: 'RATE_LIMITED', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } }); throw error; }
  let session: Awaited<ReturnType<typeof resolveExtensionSession>> | null = null;
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 220_000) return extensionJson({ error: 'Payload too large' }, { status: 413 });
    session = await resolveExtensionSession(req);
    consumeProductSession(session.user.id, 'extensionUpload');
    await requireUserFeature(session.user.id, 'linkedinExtension');
    rateLimitExtensionRequest(`${session.user.id}:ingest`);
    if (session.scope !== 'linkedin:ingest') throw new ExtensionAuthError(403, 'Insufficient extension scope');
    const body = await req.json();
    if (JSON.stringify(body).length > 220_000) return extensionJson({ error: 'Payload too large' }, { status: 413 });
    const result = await ingestLinkedInOffer(session.user.id, session.installation.id, body);
    return extensionJson(result);
  } catch (error) {
    if (error instanceof RateLimitError) return extensionJson({ error: 'RATE_LIMITED', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    log({ event: 'extension_request_failed', level: 'error', error });
    if (session) {
      await createAuditLog('extension_job_capture_rejected', session.user.id, session.user.email, {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
    if (error instanceof ExtensionAuthError || error instanceof ExtensionPayloadError || error instanceof SubscriptionAccessError) {
      return extensionJson({ error: error.message }, { status: error.status });
    }
    return extensionJson({ ...publicErrorBody(error) }, { status: 500 });
  }
}
