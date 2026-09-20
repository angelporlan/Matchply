import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { importUserData, UserDataImportError } from '@/lib/user-data-import';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8 * 1024 * 1024;

function hasValidToken(request: Request) {
  const expected = process.env.MATCHPLY_USER_IMPORT_TOKEN || '';
  const supplied = request.headers.get('x-matchply-import-token') || '';
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
    const result = await importUserData(payload);
    log({ event: 'user_data_import_succeeded', route: '/api/internal/user-data-import', userId: result.destinationUserId });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof UserDataImportError) {
      log({ event: 'user_data_import_rejected', level: 'warn', route: '/api/internal/user-data-import' });
      return NextResponse.json({ error: error.message }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
    }
    log({ event: 'user_data_import_failed', level: 'error', route: '/api/internal/user-data-import', error });
    return NextResponse.json({ error: 'Import failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
