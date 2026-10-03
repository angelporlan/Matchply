import { NextRequest, NextResponse } from 'next/server';
import { requireProductContext, assertMutableActor, auditActorFields } from '@/lib/request-context';
import { getPersonAvatar, saveManualAvatar } from '@/lib/people/avatar';
import { PeopleError } from '@/lib/people/types';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { SubscriptionAccessError } from '@/lib/permissions';
import { createAuditLog } from '@/lib/audit';
import { log } from '@/lib/logger';
import { AccountSuspendedError, ActorEpochMismatchError, ImpersonationEndedError, SupportActionBlockedError } from '@/lib/request-errors';

export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await requireProductContext({ feature: 'networking' });
    const avatar = await getPersonAvatar(ctx.effectiveUser!.id, params.id);
    const version = new URL(request.url).searchParams.get('v');
    if (!avatar || (version && version !== avatar.avatarHash)) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new NextResponse(Buffer.from(avatar.bytes, 'base64'), { headers: {
      'Content-Type': avatar.mime, 'Content-Length': String(avatar.byteSize),
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'", 'Vary': 'Cookie',
    } });
  } catch {
    return new NextResponse(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
}

async function readUpload(request: Request) {
  if (Number(request.headers.get('content-length')) > 80000) throw new PeopleError('PEOPLE_INVALID_AVATAR', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PeopleError('PEOPLE_INVALID_AVATAR');
  const decoder = new TextDecoder(); let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 80000) throw new PeopleError('PEOPLE_INVALID_AVATAR', 413);
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    const ctx = await requireProductContext({ feature: 'networking' }); assertMutableActor(ctx);
    const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || req.nextUrl.protocol.slice(0, -1);
    const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host') || req.nextUrl.host;
    let expectedOrigin: string;
    try { expectedOrigin = new URL(`${protocol}://${host}`).origin; } catch { return json({ error: 'Forbidden' }, 403); }
    if (req.headers.get('origin') !== expectedOrigin || !req.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Forbidden' }, 403);
    const userId = ctx.effectiveUser!.id;
    consumeRateLimit(`person-photo:${userId}`, 12, 60000);
    const body = await readUpload(req);
    const result = await saveManualAvatar(userId, params.id, body?.avatar);
    void createAuditLog('person_avatar_upload', userId, null, { personId: result.personId }, auditActorFields(ctx));
    return json(result);
  } catch (error) {
    if (error instanceof AccountSuspendedError || error instanceof ActorEpochMismatchError || error instanceof ImpersonationEndedError || error instanceof SupportActionBlockedError) return json({ error: error.code }, error.status);
    if (error instanceof PeopleError || error instanceof RateLimitError || error instanceof SubscriptionAccessError) return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return json({ error: 'PEOPLE_INVALID_AVATAR' }, 400);
    if (error instanceof Error && error.message === 'Unauthorized') return json({ error: 'Unauthorized' }, 401);
    log({ event: 'person_avatar_upload_failed', level: 'error' });
    return json({ error: 'PEOPLE_ACTION_FAILED' }, 500);
  }
}
