import { NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { resolveExtensionSession, ExtensionAuthError, rateLimitExtensionRequest } from '@/lib/extension-auth';
import { extensionJson, extensionOptions } from '@/lib/extension-http';
import { requireUserFeature, SubscriptionAccessError } from '@/lib/permissions';
import { saveCapturedAvatar } from '@/lib/people/avatar';
import { PeopleError } from '@/lib/people/types';
import { log } from '@/lib/logger';

export async function OPTIONS() { return extensionOptions(); }
export async function POST(req: NextRequest) {
  try {
    if (Number(req.headers.get('content-length')) > 80000) return extensionJson({ error: 'Payload too large' }, { status: 413 });
    const session = await resolveExtensionSession(req);
    if (session.scope !== 'linkedin:ingest') throw new ExtensionAuthError(403, 'Insufficient extension scope');
    await requireUserFeature(session.user.id, 'linkedinExtension');
    rateLimitExtensionRequest(`${session.user.id}:person-avatar`);
    const body = await req.json();
    if (!body || JSON.stringify(body).length > 80000 || typeof body.sourceJobId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.sourceJobId)) throw new PeopleError('PEOPLE_INVALID_CAPTURE');
    const result = await saveCapturedAvatar(session.user.id, body.sourceJobId, body.profileUrl, body.avatar);
    void createAuditLog('extension_person_avatar_capture', session.user.id, null, { personId: result.personId, installationId: session.installation.id });
    return extensionJson({ success: true, ...result });
  } catch (error) {
    if (error instanceof ExtensionAuthError || error instanceof PeopleError || error instanceof SubscriptionAccessError) return extensionJson({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return extensionJson({ error: 'PEOPLE_INVALID_AVATAR' }, { status: 400 });
    log({ event: 'person_avatar_capture_failed', level: 'error' });
    return extensionJson({ error: 'PEOPLE_AVATAR_CAPTURE_FAILED' }, { status: 500 });
  }
}
