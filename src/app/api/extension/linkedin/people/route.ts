import { NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { resolveExtensionSession, ExtensionAuthError, rateLimitExtensionRequest, markExtensionCapture } from '@/lib/extension-auth';
import { extensionJson, extensionOptions } from '@/lib/extension-http';
import { requireUserFeature, SubscriptionAccessError } from '@/lib/permissions';
import { capturePeople } from '@/lib/people/service';
import { captureInput } from '@/lib/people/validation';
import { PeopleError } from '@/lib/people/types';

export async function OPTIONS() { return extensionOptions(); }
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get('content-length')) > 40000) return extensionJson({ error: 'Payload too large' }, { status: 413 });
    const session = await resolveExtensionSession(req);
    if (session.scope !== 'linkedin:ingest') throw new ExtensionAuthError(403, 'Insufficient extension scope');
    await requireUserFeature(session.user.id, 'linkedinExtension');
    rateLimitExtensionRequest(`${session.user.id}:people`);
    const body = await req.json();
    if (!body || JSON.stringify(body).length > 40000 || typeof body.sourceJobId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.sourceJobId)) throw new PeopleError('PEOPLE_INVALID_CAPTURE');
    const result = await capturePeople(session.user.id, body.sourceJobId, captureInput(body.people));
    await markExtensionCapture(session.installation.id);
    void createAuditLog('extension_people_capture', session.user.id, null, { sourceJobId: body.sourceJobId, installationId: session.installation.id, count: result.captured, created: result.created });
    return extensionJson({ success: true, ...result });
  } catch (error) {
    if (error instanceof ExtensionAuthError || error instanceof PeopleError || error instanceof SubscriptionAccessError) return extensionJson({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return extensionJson({ error: 'PEOPLE_INVALID_CAPTURE' }, { status: 400 });
    return extensionJson({ error: 'PEOPLE_CAPTURE_FAILED' }, { status: 500 });
  }
}
