import { randomBytes } from 'crypto';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { NextRequest } from 'next/server';
import { db } from '@/db';
import { userApiTokens, users } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import {
  AGENT_SCOPES,
  API_TOKEN_PREFIX,
  type AgentScope,
  isAgentScope,
} from '@/lib/agent-api/scopes';
import { sha256Hex } from '@/lib/crypto-hash';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import { canAccessFeature } from '@/lib/subscription';

const TOKEN_RE = /^mp_live_[a-f0-9]{64}$/;
const MAX_AUTH_HEADER = 100;
const INVALID_TOKEN = 'La clave no es válida.';
const TOUCH_INTERVAL_MS = 5 * 60_000;
const lastUsedTouch = new Map<string, number>();

export type AgentPrincipal = {
  tokenId: string;
  userId: string;
  email: string;
  name: string | null;
  scopes: AgentScope[];
  subscriptionStatus: string;
  isGuest: boolean;
  accountStatus: string;
  proGrantedUntil: Date | null;
};

export function generateApiToken() {
  const secret = randomBytes(32).toString('hex');
  const token = `${API_TOKEN_PREFIX}${secret}`;
  return {
    token,
    tokenHash: sha256Hex(token),
    lastChars: secret.slice(-4),
  };
}

export function parseBearerApiToken(header: string | null) {
  if (!header || header.length > MAX_AUTH_HEADER || !header.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return TOKEN_RE.test(token) ? token : null;
}

export function parseApiTokenScopes(value: unknown): AgentScope[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AgentApiError(400, 'invalid_scopes', 'Elige al menos un permiso.');
  }
  const seen = new Set<AgentScope>();
  for (const item of value) {
    if (typeof item !== 'string' || !isAgentScope(item)) {
      throw new AgentApiError(400, 'invalid_scopes', 'Hay un permiso que no existe.');
    }
    seen.add(item);
  }
  return AGENT_SCOPES.filter((scope) => seen.has(scope));
}

export function apiTokenIsUsable(
  row: { revokedAt: Date | null; expiresAt: Date | null },
  now = new Date(),
) {
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

function clientIp(req: { headers: { get(name: string): string | null } }) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return ip.slice(0, 64);
  }
  return req.headers.get('x-real-ip')?.trim().slice(0, 64) || 'unknown';
}

function enforceLimit(key: string, limit: number, windowMs: number, retryAfterSeconds: number) {
  try {
    consumeRateLimit(key, limit, windowMs);
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AgentApiError(429, 'rate_limited', 'Demasiadas peticiones. Inténtalo de nuevo más tarde.', retryAfterSeconds);
    }
    throw error;
  }
}

function scopesFromRow(value: unknown): AgentScope[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const scopes: AgentScope[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isAgentScope(item) || scopes.includes(item)) return null;
    scopes.push(item);
  }
  return scopes;
}

export async function touchApiTokenLastUsed(tokenId: string, now = new Date()) {
  const last = lastUsedTouch.get(tokenId) || 0;
  if (now.getTime() - last < TOUCH_INTERVAL_MS) return;
  lastUsedTouch.set(tokenId, now.getTime());
  try {
    await db
      .update(userApiTokens)
      .set({ lastUsedAt: now })
      .where(and(
        eq(userApiTokens.id, tokenId),
        or(isNull(userApiTokens.lastUsedAt), lt(userApiTokens.lastUsedAt, new Date(now.getTime() - TOUCH_INTERVAL_MS))),
      ));
  } catch {
    lastUsedTouch.delete(tokenId);
  }
}

export function requireAgentScope(auth: AgentPrincipal, scope: AgentScope) {
  if (!auth.scopes.includes(scope)) {
    throw new AgentApiError(403, 'insufficient_scope', 'La clave no tiene permiso para esta operación.');
  }
}

export async function authenticateAgentRequest(req: NextRequest): Promise<AgentPrincipal> {
  enforceLimit(`agent:ip:${clientIp(req)}`, 60, 60_000, 60);

  const token = parseBearerApiToken(req.headers.get('authorization'));
  if (!token) throw new AgentApiError(401, 'invalid_token', INVALID_TOKEN);

  const [row] = await db
    .select({
      id: userApiTokens.id,
      scopes: userApiTokens.scopes,
      revokedAt: userApiTokens.revokedAt,
      expiresAt: userApiTokens.expiresAt,
      email: users.email,
      name: users.name,
      subscriptionStatus: users.subscriptionStatus,
      isGuest: users.isGuest,
      accountStatus: users.accountStatus,
      proGrantedUntil: users.proGrantedUntil,
      userId: users.id,
    })
    .from(userApiTokens)
    .innerJoin(users, eq(users.id, userApiTokens.userId))
    .where(eq(userApiTokens.tokenHash, sha256Hex(token)))
    .limit(1);

  if (!row || !apiTokenIsUsable(row)) {
    throw new AgentApiError(401, 'invalid_token', INVALID_TOKEN);
  }

  const scopes = scopesFromRow(row.scopes);
  if (!scopes) throw new AgentApiError(401, 'invalid_token', INVALID_TOKEN);

  if (row.isGuest || row.accountStatus === 'suspended') {
    throw new AgentApiError(403, 'forbidden', 'Esta cuenta no puede usar la API de agente.');
  }

  if (!canAccessFeature(row.subscriptionStatus, 'agentApi', {
    isGuest: row.isGuest,
    proGrantedUntil: row.proGrantedUntil,
  })) {
    throw new AgentApiError(403, 'subscription_required', 'Las claves de agente requieren un plan PRO.');
  }

  enforceLimit(`agent:token:${row.id}`, 120, 60_000, 60);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    enforceLimit(`agent:write:${row.userId}`, 40, 60_000, 60);
  }

  void touchApiTokenLastUsed(row.id);

  return {
    tokenId: row.id,
    userId: row.userId,
    email: row.email,
    name: row.name,
    scopes,
    subscriptionStatus: row.subscriptionStatus,
    isGuest: row.isGuest,
    accountStatus: row.accountStatus,
    proGrantedUntil: row.proGrantedUntil,
  };
}
