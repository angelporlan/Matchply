import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { parseProblemReport } from '@/lib/problem-report-schema';
import { saveProblemReport } from '@/lib/problem-reports';
import { consumeRateLimit } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const host = request.headers.get('host') || new URL(request.url).host;
  const protocol = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '');
  if (!['http', 'https'].includes(protocol) || request.headers.get('origin') !== `${protocol}://${host}`) return new NextResponse(null, { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return new NextResponse(null, { status: 415 });
  const maxBytes = 10_240;
  if (Number(request.headers.get('content-length')) > maxBytes) return new NextResponse(null, { status: 413 });
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const session = ['matchply_guest', '__Secure-authjs.session-token', 'authjs.session-token'].map(name => request.cookies.get(name)?.value).find(Boolean);
  try {
    consumeRateLimit(`problem-report:ip:${hash(ip)}`, 5, 10 * 60_000);
    if (session) consumeRateLimit(`problem-report:session:${hash(session)}`, 5, 10 * 60_000);
    consumeRateLimit('problem-report:global', 120, 60_000);
  } catch { return NextResponse.json({ code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '600', 'Cache-Control': 'no-store' } }); }
  const reader = request.body?.getReader();
  if (!reader) return new NextResponse(null, { status: 400 });
  let raw = '', bytes = 0, timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}); }, 5000);
  let input;
  try {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); return new NextResponse(null, { status: 413 }); }
      raw += decoder.decode(value, { stream: true });
    }
    if (timedOut) return new NextResponse(null, { status: 408 });
    input = parseProblemReport(JSON.parse(raw + decoder.decode()));
    if (!input) return new NextResponse(null, { status: 400 });
  } catch { return new NextResponse(null, { status: timedOut ? 408 : 400 }); }
  finally { clearTimeout(timeout); reader.releaseLock(); }
  try {
    if (!await saveProblemReport(input)) return NextResponse.json({ code: 'INVALID_INPUT' }, { status: 409 });
    return NextResponse.json({ accepted: true, id: input.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // Do not put the comment, IP, cookie or database exception in logs/telemetry.
    log({ event: 'problem_report_save_failed', level: 'error', code: 'UNEXPECTED_ERROR', route: '/api/diagnostics/reports' });
    return NextResponse.json({ code: 'UNEXPECTED_ERROR' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
