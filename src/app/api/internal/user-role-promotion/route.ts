import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';
import { promoteUserToAdmin } from '@/lib/user-role-promotion';
import { UserRolePromotionError } from '@/lib/user-role-promotion-contract';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 16 * 1024;

function hasValidToken(request: Request) {
  const expected = process.env.MATCHPLY_USER_ROLE_PROMOTION_TOKEN || '';
  const supplied = request.headers.get('x-matchply-role-promotion-token') || '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  if (!hasValidToken(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const result = await promoteUserToAdmin(payload);
    log({ event: 'internal_user_role_promotion_succeeded', route: '/api/internal/user-role-promotion', changed: result.changed });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof UserRolePromotionError) {
      log({ event: 'internal_user_role_promotion_rejected', level: 'warn', route: '/api/internal/user-role-promotion' });
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    const message = error instanceof Error ? error.message : '';
    if (message === 'User not found') {
      return NextResponse.json({ error: message }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }
    if (message === 'The account must be active') {
      return NextResponse.json({ error: message }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    log({ event: 'internal_user_role_promotion_failed', level: 'error', route: '/api/internal/user-role-promotion', error });
    return NextResponse.json({ error: 'Role promotion failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
