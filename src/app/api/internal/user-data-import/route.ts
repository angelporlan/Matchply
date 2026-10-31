import { timingSafeEqual } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';
import { importUserData, UserDataImportError } from '@/lib/user-data-import';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_COMPRESSED_BODY_BYTES = 8 * 1024 * 1024;
const MAX_UNCOMPRESSED_BODY_BYTES = 16 * 1024 * 1024;

function hasValidToken(request: Request) {
  const expected = process.env.MATCHPLY_USER_IMPORT_TOKEN || '';
  const supplied = request.headers.get('x-matchply-import-token') || '';
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function isBufferTooLarge(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE';
}

export async function POST(request: Request) {
  if (!hasValidToken(request)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const encoding = (request.headers.get('content-encoding') || 'identity').toLowerCase();
  if (encoding !== 'identity' && encoding !== 'gzip') {
    return NextResponse.json({ error: 'Unsupported content encoding' }, { status: 415, headers: { 'Cache-Control': 'no-store' } });
  }

  const bodyLimit = encoding === 'gzip' ? MAX_COMPRESSED_BODY_BYTES : MAX_UNCOMPRESSED_BODY_BYTES;
  const compressed = Buffer.from(await request.arrayBuffer());
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > bodyLimit || compressed.byteLength > bodyLimit) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }

  let body: Buffer;
  try {
    body = encoding === 'gzip'
      ? gunzipSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BODY_BYTES })
      : compressed;
  } catch (error) {
    if (isBufferTooLarge(error)) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'Invalid compressed payload' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (body.byteLength > MAX_UNCOMPRESSED_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
  }
  const raw = body.toString('utf8');

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
