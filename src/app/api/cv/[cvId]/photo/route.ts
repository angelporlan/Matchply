import { checkProductIp, consumeProductSession } from '@/lib/product-rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getActor } from '@/lib/actor';
import { getCvPhotoState, resolveCvPhoto, resetCvPhoto, saveCvPhoto, setCvPhotoEnabled } from '@/lib/cv-photo';
import { PROFILE_PHOTO_BODY_MAX_BYTES } from '@/lib/avatar/profile-limits';
import { RateLimitError } from '@/lib/rate-limit';
import { UsageError } from '@/lib/usage';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
type Context = { params: { cvId: string } };
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
function failure(error: unknown) {
  if (error instanceof UsageError) return json(error.toJSON(), error.status);
  if (error instanceof RateLimitError) { const response = json({ error: 'PHOTO_RATE_LIMIT' }, 429); response.headers.set('Retry-After', String(error.retryAfterSeconds)); return response; }
  if (error instanceof SyntaxError || (error instanceof Error && error.message === 'PHOTO_INVALID')) return json({ error: 'PHOTO_INVALID' }, 400);
  if (error instanceof Error && error.message === 'PHOTO_SIZE') return json({ error: 'PHOTO_SIZE' }, 413);
  if (error && typeof error === 'object' && 'status' in error && 'code' in error && typeof error.status === 'number') return json({ error: error.code }, error.status);
  log({ event: 'cv_photo_failed', level: 'error', error });
  return json({ error: 'PHOTO_SAVE_FAILED' }, 500);
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return json({ error: 'Unauthorized' }, 401);
    if (!/^[\da-f-]{36}$/i.test(params.cvId)) return json({ error: 'CV_NOT_FOUND' }, 404);
    const state = await getCvPhotoState(actor.userId, params.cvId);
    if (request.nextUrl.searchParams.has('metadata')) return json(state);
    const photo = state.enabled ? await resolveCvPhoto(actor.userId, params.cvId) : null;
    const version = request.nextUrl.searchParams.get('v');
    if (!photo || (version && version !== photo.hash)) return json({ error: 'PHOTO_MISSING' }, 404);
    return new NextResponse(Buffer.from(photo.bytes, 'base64'), { headers: { 'Content-Type': photo.mime, 'Content-Length': String(photo.byteSize), 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" } });
  } catch (error) { return failure(error); }
}
async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > PROFILE_PHOTO_BODY_MAX_BYTES) throw new Error('PHOTO_SIZE');
  const reader = request.body?.getReader(); if (!reader) throw new Error('PHOTO_INVALID');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > PROFILE_PHOTO_BODY_MAX_BYTES) throw new Error('PHOTO_SIZE');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); }
}
async function mutate(request: NextRequest, { params }: Context, action: 'upload' | 'toggle' | 'reset') {
  const limited = checkProductIp(request, 'cvPhoto'); if (limited) return limited;
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) return json({ error: 'Unauthorized' }, 401);
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || request.nextUrl.protocol.slice(0, -1);
    const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host') || request.nextUrl.host;
    if (request.headers.get('origin') !== new URL(`${protocol}://${host}`).origin || (action !== 'reset' && !request.headers.get('content-type')?.startsWith('application/json'))) return json({ error: 'Forbidden' }, 403);
    if (!/^[\da-f-]{36}$/i.test(params.cvId)) return json({ error: 'CV_NOT_FOUND' }, 404);
    consumeProductSession(actor.userId, 'cvPhoto');
    const body = action === 'reset' ? null : await readBody(request);
    const state = action === 'upload' ? await saveCvPhoto(actor.userId, params.cvId, body?.avatar)
      : action === 'toggle' ? await setCvPhotoEnabled(actor.userId, params.cvId, body?.enabled) : await resetCvPhoto(actor.userId, params.cvId);
    revalidatePath(`/editor/${params.cvId}`); revalidatePath('/dashboard');
    return json(state);
  } catch (error) { return failure(error); }
}
export const POST = (request: NextRequest, context: Context) => mutate(request, context, 'upload');
export const PATCH = (request: NextRequest, context: Context) => mutate(request, context, 'toggle');
export const DELETE = (request: NextRequest, context: Context) => mutate(request, context, 'reset');
