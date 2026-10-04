import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { AgentApiError } from '@/lib/agent-api/errors';
import type { AgentScope } from '@/lib/agent-api/scopes';
import {
  authenticateAgentRequest,
  requireAgentScope,
  type AgentPrincipal,
} from '@/lib/api-key-auth';
import { log } from '@/lib/logger';
import { CompanyValidationError } from '@/lib/company-service';
import { UsageError } from '@/lib/usage';

const READ_AUDIT_MS = 15 * 60_000;
const readAuditedAt = new Map<string, number>();

const VALIDATION_CODES = new Set([
  'invalid_name',
  'invalid_scopes',
  'too_many_keys',
  'invalid_json',
  'invalid_body',
  'invalid_status',
  'invalid_platform',
  'invalid_url',
  'invalid_title',
  'invalid_company',
  'invalid_description',
  'invalid_note',
  'invalid_cv',
  'invalid_content',
  'invalid_template',
  'invalid_style',
  'invalid_cursor',
  'invalid_limit',
  'invalid_followup',
  'invalid_external_id',
  'empty_patch',
  'note_requires_company',
]);

export function agentJson(body: unknown, status = 200, retryAfterSeconds?: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set('Cache-Control', 'no-store');
  if (retryAfterSeconds) response.headers.set('Retry-After', String(retryAfterSeconds));
  return response;
}

export function publicErrorCode(code: string) {
  return VALIDATION_CODES.has(code) ? 'validation' : code;
}

function shouldAuditRead(tokenId: string, now = Date.now()) {
  const last = readAuditedAt.get(tokenId) || 0;
  if (now - last < READ_AUDIT_MS) return false;
  readAuditedAt.set(tokenId, now);
  return true;
}

function recordRead(auth: AgentPrincipal, req: NextRequest) {
  const route = req.nextUrl.pathname;
  log({ event: 'agent_api_read', userId: auth.userId, route, method: req.method, apiKeyId: auth.tokenId });
  if (!shouldAuditRead(auth.tokenId)) return;
  void createAuditLog('agent_api_read', auth.userId, auth.email, {
    method: req.method,
    route,
    apiKeyId: auth.tokenId,
  });
}

export function agentErrorResponse(error: unknown) {
  if (error instanceof UsageError) return agentJson({ error: { code: error.code, message: error.message, ...error.details } }, error.status);
  if (error instanceof AgentApiError) {
    return agentJson(
      { error: { code: publicErrorCode(error.code), message: error.message } },
      error.status,
      error.retryAfterSeconds,
    );
  }
  if (error instanceof CompanyValidationError) {
    return agentJson({ error: { code: 'validation', message: 'Los datos de la empresa o la nota no son válidos.' } }, 400);
  }
  log({ event: 'agent_api_error', level: 'error', error });
  return agentJson({ error: { code: 'internal', message: 'No se pudo completar la operación.' } }, 500);
}

export async function readAgentBody(req: NextRequest, maxBytes: number) {
  const advertised = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(advertised) && advertised > maxBytes) {
    throw new AgentApiError(413, 'payload_too_large', 'La petición es demasiado grande.');
  }
  const text = await req.text();
  if (text.length > maxBytes) {
    throw new AgentApiError(413, 'payload_too_large', 'La petición es demasiado grande.');
  }
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AgentApiError(400, 'invalid_json', 'El cuerpo no es JSON.');
  }
}

export async function handleAgent(
  req: NextRequest,
  scope: AgentScope,
  run: (auth: AgentPrincipal) => Promise<Record<string, unknown>>,
  options: { read?: boolean } = {},
) {
  try {
    const auth = await authenticateAgentRequest(req);
    requireAgentScope(auth, scope);
    if (options.read) recordRead(auth, req);
    return agentJson(await run(auth));
  } catch (error) {
    return agentErrorResponse(error);
  }
}
