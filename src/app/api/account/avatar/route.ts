import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { unstable_update } from '@/auth';
import { requireAccountContext, requireProductContext, auditActorFields } from '@/lib/request-context';
import { getProfilePhoto, saveProfilePhoto } from '@/lib/avatar/profile';
import { PROFILE_PHOTO_BODY_MAX_BYTES } from '@/lib/avatar/profile-limits';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { createAuditLog } from '@/lib/audit';
import { log } from '@/lib/logger';
import { AccountSuspendedError, ActorEpochMismatchError, ImpersonationEndedError, SupportActionBlockedError } from '@/lib/request-errors';

export const dynamic = 'force-dynamic';

const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  try {
    const ctx = await requireProductContext();
    const avatar = await getProfilePhoto(ctx.effectiveUser!.id);
    const version = new URL(request.url).searchParams.get('v');
    if (!avatar || (version && version !== avatar.hash)) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new NextResponse(Buffer.from(avatar.bytes, 'base64'), { headers: {
      'Content-Type': avatar.mime, 'Content-Length': String(avatar.byteSize),
      'Cache-Control': 'private, no-store', 'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'",
    } });
  } catch {
    return new NextResponse(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
}

async function readUpload(request: Request) {
  if (Number(request.headers.get('content-length')) > PROFILE_PHOTO_BODY_MAX_BYTES) throw new Error('PHOTO_SIZE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('PHOTO_INVALID');
  const decoder = new TextDecoder();
  let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > PROFILE_PHOTO_BODY_MAX_BYTES) throw new Error('PHOTO_SIZE');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { await reader.cancel().catch(() => {}); }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAccountContext();
    if (ctx.realUser.isGuest) return json({ error: 'Unauthorized' }, 401);
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.nextUrl.protocol.slice(0, -1);
    const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || request.nextUrl.host;
    if (request.headers.get('origin') !== new URL(`${protocol}://${host}`).origin || !request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Forbidden' }, 403);
    const userId = ctx.realUser.id;
    consumeRateLimit(`profile-photo:${userId}`, 12, 60_000);
    const body = await readUpload(request);
    const result = await saveProfilePhoto(userId, body?.avatar);
    void createAuditLog('user_avatar_upload', userId, null, {}, auditActorFields(ctx));
    try { await unstable_update({}); }
    catch { log({ event: 'profile_photo_session_refresh_failed', level: 'error', userId }); }
    revalidatePath('/dashboard', 'layout');
    revalidatePath('/admin', 'layout');
    return json(result);
  } catch (error) {
    if (error instanceof AccountSuspendedError || error instanceof ActorEpochMismatchError || error instanceof ImpersonationEndedError || error instanceof SupportActionBlockedError) return json({ error: error.code }, error.status);
    if (error instanceof RateLimitError) return json({ error: 'PHOTO_RATE_LIMIT' }, error.status);
    if (error instanceof SyntaxError || (error instanceof Error && error.message === 'PHOTO_INVALID')) return json({ error: 'PHOTO_INVALID' }, 400);
    if (error instanceof Error && error.message === 'PHOTO_SIZE') return json({ error: 'PHOTO_SIZE' }, 413);
    if (error instanceof Error && error.message === 'Unauthorized') return json({ error: 'Unauthorized' }, 401);
    log({ event: 'profile_photo_upload_failed', level: 'error' });
    return json({ error: 'PHOTO_SAVE_FAILED' }, 500);
  }
}
