import { NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { resolveExtensionSession, ExtensionAuthError, rateLimitExtensionRequest } from '@/lib/extension-auth';
import { extensionJson, extensionOptions } from '@/lib/extension-http';
import { ExtensionPayloadError, ingestLinkedInOffer } from '@/lib/extension-service';
import { SubscriptionAccessError } from '@/lib/permissions';

export async function OPTIONS() {
  return extensionOptions();
}

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof resolveExtensionSession>> | null = null;
  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 220_000) return extensionJson({ error: 'Payload too large' }, { status: 413 });
    session = await resolveExtensionSession(req);
    rateLimitExtensionRequest(`${session.user.id}:ingest`);
    if (session.scope !== 'linkedin:ingest') throw new ExtensionAuthError(403, 'Insufficient extension scope');
    const body = await req.json();
    if (JSON.stringify(body).length > 220_000) return extensionJson({ error: 'Payload too large' }, { status: 413 });
    const result = await ingestLinkedInOffer(session.user.id, session.installation.id, body);
    return extensionJson(result);
  } catch (error) {
    if (session) {
      await createAuditLog('extension_job_capture_rejected', session.user.id, session.user.email, {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
    if (error instanceof ExtensionAuthError || error instanceof ExtensionPayloadError || error instanceof SubscriptionAccessError) {
      return extensionJson({ error: error.message }, { status: error.status });
    }
    return extensionJson({ error: error instanceof Error ? error.message : 'Unable to ingest LinkedIn offer' }, { status: 500 });
  }
}
