import { NextRequest, NextResponse } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { AgentApiError, ResearchQuotaError } from '@/lib/agent-api/errors';
import type { AgentScope } from '@/lib/agent-api/scopes';
import {
  authenticateAgentRequest,
  requireAgentScope,
  type AgentPrincipal,
} from '@/lib/api-key-auth';
import { log } from '@/lib/logger';
import { ApplicationNotFoundError } from '@/lib/application-service';
import { CompanyHasApplicationsError, CompanyNameConflictError, CompanyNotFoundError, CompanyValidationError } from '@/lib/company-service';
import { PeopleError } from '@/lib/people/types';
import { SubscriptionAccessError } from '@/lib/permissions';
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
  'invalid_entity',
  'invalid_view',
  'invalid_ids',
  'invalid_page',
  'invalid_score_breakdown',
  'invalid_match',
  'invalid_outreach',
  'invalid_questions',
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
  if (error instanceof ResearchQuotaError) {
    return agentJson({
      error: { code: 'QUOTA_EXCEEDED', message: 'Has agotado las acciones de IA de este mes.' },
      quota: error.quota,
    }, 429);
  }
  if (error instanceof ApplicationNotFoundError) {
    return agentJson({ error: { code: 'not_found', message: 'No se ha encontrado la candidatura.' } }, 404);
  }
  if (error instanceof SubscriptionAccessError) {
    return agentJson({ error: { code: 'plan_required', message: 'El plan no incluye la investigación profunda.' } }, 403);
  }
  if (error instanceof CompanyValidationError) {
    return agentJson({ error: { code: 'validation', message: 'Los datos de la empresa o la nota no son válidos.' } }, 400);
  }
  if (error instanceof CompanyNameConflictError) {
    return agentJson({ error: { code: 'conflict', message: 'Ya existe una empresa con ese nombre.' } }, 409);
  }
  if (error instanceof CompanyHasApplicationsError) {
    return agentJson({ error: { code: 'conflict', message: 'La empresa tiene candidaturas y no se puede borrar.' } }, 409);
  }
  if (error instanceof CompanyNotFoundError) {
    return agentJson({ error: { code: 'not_found', message: 'No se ha encontrado la empresa.' } }, 404);
  }
  if (error instanceof PeopleError) {
    if (error.message === 'PEOPLE_PROFILE_EXISTS') {
      return agentJson({ error: { code: 'conflict', message: 'Ya existe una persona con ese perfil de LinkedIn.' } }, 409);
    }
    if (error.status === 404) {
      const message = error.message === 'PEOPLE_OFFER_NOT_FOUND'
        ? 'No se ha encontrado la candidatura.'
        : 'No se ha encontrado la persona.';
      return agentJson({ error: { code: 'not_found', message } }, 404);
    }
    return agentJson({ error: { code: 'validation', message: 'Los datos de la persona no son válidos.' } }, 400);
  }
  if (error instanceof Error && error.message === 'NOT_FOUND') {
    return agentJson({ error: { code: 'not_found', message: 'No se ha encontrado el recurso.' } }, 404);
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
