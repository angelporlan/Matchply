'use client';

import { diagnosticRoute, type ErrorStep } from '@/lib/diagnostics-schema';
import { validRequestId } from '@/lib/request-id';
import { userError } from '@/lib/user-errors';

let lastRequestId: string | undefined;
type ReportContext = { requestId?: string; step: ErrorStep; path: string };
let lastOperation: ReportContext | undefined;
let lastFailure: ReportContext | undefined;
export function problemReportContext(path: string): { requestId: string | null; step: ErrorStep; route: string } {
  const context = lastFailure?.path === path ? lastFailure : lastOperation?.path === path ? lastOperation : undefined;
  const step: ErrorStep = path === '/try' ? 'cv-import' : path === '/register' ? 'registration' : path.startsWith('/editor/') ? 'editor' : 'page';
  return { requestId: context?.requestId || lastRequestId || null, step: context?.step || step, route: diagnosticRoute(path) };
}
const reported = new Set<string>();
export function rememberRequestId(value: unknown) { const id = validRequestId(value); if (id) lastRequestId = id; }
export function lastDiagnosticRequestId() { return lastRequestId; }

export function reportClientError(error: unknown, step: ErrorStep, requestId = lastRequestId, path = window.location.pathname) {
  const code = userError(error).code;
  const id = validRequestId(requestId) || crypto.randomUUID();
  const digest = error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(error.digest) ? error.digest : undefined;
  const key = `${id}:${step}:${code}:${digest || ''}`;
  if (reported.has(key)) return id;
  rememberRequestId(id);
  lastFailure = { requestId: id, step, path };
  reported.add(key);
  if (reported.size > 128) reported.delete(reported.values().next().value!);
  void fetch('/api/diagnostics/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: id, code, step, digest, route: diagnosticRoute(path) }),
    keepalive: true, signal: AbortSignal.timeout(5000),
  }).catch(() => { /* Diagnostics must never interrupt the product or report its own failure. */ });
  return id;
}

function stepFor(path: string): ErrorStep {
  if (path.startsWith('/api/ai/offers/')) return 'offer-import';
  if (path === '/api/cv/import' || path === '/api/cv/parse-pdf') return 'cv-import';
  if (path.startsWith('/api/ai/')) return 'optimization';
  if (path === '/api/pdf' || path.startsWith('/api/cv/exports/')) return 'pdf-download';
  return 'editor';
}

async function reportResponseFailure(response: Response, step: ErrorStep, requestId: string, path: string) {
  const reader = response.body?.getReader();
  if (!reader) { reportClientError(response.status === 429 ? 'RATE_LIMITED' : 'UNEXPECTED_ERROR', step, requestId, path); return; }
  const timeout = setTimeout(() => { void reader.cancel().catch(() => {}); }, 3000);
  let raw = '', bytes = 0;
  try {
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) break;
      raw += decoder.decode(value, { stream: true });
    }
    let problem: unknown = response.status === 429 ? 'RATE_LIMITED' : 'UNEXPECTED_ERROR';
    try { problem = JSON.parse(raw + decoder.decode()); } catch { /* fixed fallback */ }
    reportClientError(problem, step, requestId, path);
  } catch { reportClientError('NETWORK_ERROR', step, requestId, path); }
  finally { clearTimeout(timeout); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Observe only our product API. No request/response bodies or exception text are transmitted. */
export function observeProductErrors() {
  const original = window.fetch;
  const observed: typeof fetch = async (input, init) => {
    let url: URL;
    try { url = new URL(input instanceof Request ? input.url : String(input), window.location.href); } catch { return original(input, init); }
    if (url.origin !== window.location.origin || !/^\/api\/(?:ai\/|cv\/|pdf(?:$|\/)|research\/)/.test(url.pathname)) return original(input, init);
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const requestId = validRequestId(headers.get('x-request-id')) || crypto.randomUUID();
    headers.set('x-request-id', requestId);
    rememberRequestId(requestId);
    const requestPage = window.location.pathname;
    lastOperation = { requestId, step: stepFor(url.pathname), path: requestPage };
    try {
      const response = await original(input, { ...init, headers });
      const responseId = validRequestId(response.headers.get('x-request-id')) || requestId;
      rememberRequestId(responseId);
      if (lastOperation?.requestId === requestId) lastOperation = { ...lastOperation, requestId: responseId };
      if (!response.ok) void reportResponseFailure(response.clone(), stepFor(url.pathname), responseId, requestPage);
      return response;
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) reportClientError('NETWORK_ERROR', stepFor(url.pathname), requestId, requestPage);
      throw error;
    }
  };
  window.fetch = observed;
  const onError = (event: ErrorEvent) => { reportClientError(event.error, 'page'); };
  const onRejected = (event: PromiseRejectionEvent) => { reportClientError(event.reason, 'page'); };
  window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejected);
  return () => {
    if (window.fetch === observed) window.fetch = original;
    window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejected);
  };
}
