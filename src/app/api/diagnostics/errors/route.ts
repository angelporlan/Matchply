import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { parseClientError } from '@/lib/diagnostics-schema';
import { consumeRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';
import { validRequestId } from '@/lib/request-id';

export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || new URL(request.url).host;
  const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
  if (!['http', 'https'].includes(protocol) || request.headers.get('origin') !== `${protocol}://${host}`) return new NextResponse(null, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) return new NextResponse(null, { status: 415 });
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > 2048) return new NextResponse(null, { status: 413 });
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = createHash('sha256').update(ip).digest('hex');
  try { consumeRateLimit(`diagnostics:${key}`, 30, 10 * 60_000); consumeRateLimit('diagnostics:global', 300, 60_000); }
  catch { return new NextResponse(null, { status: 429 }); }
  const reader = request.body?.getReader();
  let raw = '', bytes = 0;
  if (!reader) return new NextResponse(null, { status: 400 });
  const timeout = setTimeout(() => { void reader.cancel().catch(() => {}); }, 5000);
  try {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) { await reader.cancel(); return new NextResponse(null, { status: 413 }); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const body = parseClientError(JSON.parse(raw));
    if (!body) return new NextResponse(null, { status: 400 });
    const requestId = body.requestId || validRequestId(request.headers.get('x-request-id')) || randomUUID();
    log({ event: `browser_${body.step.replaceAll('-', '_')}_failed`, level: 'error', errorSource: 'browser',
      requestId, code: body.code, digest: body.digest, route: body.route });
    return NextResponse.json({ accepted: true, requestId }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch { return new NextResponse(null, { status: 400 }); }
  finally { clearTimeout(timeout); reader.releaseLock(); }
}
