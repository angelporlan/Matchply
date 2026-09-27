import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { userApiTokens } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import {
  MAX_ACTIVE_API_TOKENS,
  type AgentScope,
  type ApiTokenView,
  isAgentScope,
} from '@/lib/agent-api/scopes';
import { isUuid } from '@/lib/agent-api/validate';
import { generateApiToken } from '@/lib/api-key-auth';
import { sha256Hex } from '@/lib/crypto-hash';
import { decryptSecret, encryptSecret } from '@/lib/secret-box';

function viewScopes(value: unknown): AgentScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AgentScope => typeof item === 'string' && isAgentScope(item));
}

function toView(row: {
  id: string;
  name: string;
  lastChars: string;
  scopes: unknown;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date | null;
}, recoverable = false): ApiTokenView {
  return {
    id: row.id,
    name: row.name,
    lastChars: row.lastChars,
    scopes: viewScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    recoverable,
  };
}

const tokenColumns = {
  id: userApiTokens.id,
  name: userApiTokens.name,
  lastChars: userApiTokens.lastChars,
  scopes: userApiTokens.scopes,
  createdAt: userApiTokens.createdAt,
  lastUsedAt: userApiTokens.lastUsedAt,
  revokedAt: userApiTokens.revokedAt,
  expiresAt: userApiTokens.expiresAt,
};

export async function listUserApiTokens(userId: string): Promise<ApiTokenView[]> {
  const rows = await db
    .select({
      ...tokenColumns,
      recoverable: sql<boolean>`${userApiTokens.tokenCipher} is not null`,
    })
    .from(userApiTokens)
    .where(eq(userApiTokens.userId, userId))
    .orderBy(desc(userApiTokens.createdAt));
  return rows.map((row) => toView(row, Boolean(row.recoverable)));
}

export async function createUserApiToken(userId: string, name: string, scopes: AgentScope[]) {
  const [countRow] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(userApiTokens)
    .where(and(eq(userApiTokens.userId, userId), isNull(userApiTokens.revokedAt)));
  if ((Number(countRow?.count) || 0) >= MAX_ACTIVE_API_TOKENS) {
    throw new AgentApiError(400, 'too_many_keys', 'Ya tienes 10 claves activas. Revoca una para crear otra.');
  }

  const generated = generateApiToken();
  const [created] = await db
    .insert(userApiTokens)
    .values({
      userId,
      name,
      tokenHash: generated.tokenHash,
      tokenCipher: encryptSecret(generated.token),
      lastChars: generated.lastChars,
      scopes,
    })
    .returning(tokenColumns);

  return { token: generated.token, apiToken: toView(created, true) };
}

export async function revealUserApiToken(userId: string, tokenId: string) {
  if (!isUuid(tokenId)) {
    throw new AgentApiError(404, 'not_found', 'No se ha encontrado la clave.');
  }
  const [row] = await db
    .select({
      tokenCipher: userApiTokens.tokenCipher,
      tokenHash: userApiTokens.tokenHash,
    })
    .from(userApiTokens)
    .where(and(eq(userApiTokens.id, tokenId), eq(userApiTokens.userId, userId)))
    .limit(1);
  if (!row?.tokenCipher) {
    throw new AgentApiError(409, 'token_unavailable', 'Esta clave se creó sin guardar el token completo.');
  }
  let token: string;
  try {
    token = decryptSecret(row.tokenCipher);
  } catch {
    throw new AgentApiError(409, 'token_unavailable', 'No se pudo recuperar el token.');
  }
  if (sha256Hex(token) !== row.tokenHash) {
    throw new AgentApiError(409, 'token_unavailable', 'No se pudo recuperar el token.');
  }
  return token;
}

export async function revokeUserApiToken(userId: string, tokenId: string) {
  if (!isUuid(tokenId)) {
    throw new AgentApiError(404, 'not_found', 'No hay una clave activa con ese identificador.');
  }
  const [updated] = await db
    .update(userApiTokens)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(userApiTokens.id, tokenId),
      eq(userApiTokens.userId, userId),
      isNull(userApiTokens.revokedAt),
    ))
    .returning({ id: userApiTokens.id });
  if (!updated) {
    throw new AgentApiError(404, 'not_found', 'No hay una clave activa con ese identificador.');
  }
  return updated;
}

export async function deleteRevokedUserApiToken(userId: string, tokenId: string) {
  if (!isUuid(tokenId)) {
    throw new AgentApiError(404, 'not_found', 'No se ha encontrado la clave.');
  }
  const [row] = await db
    .select({
      id: userApiTokens.id,
      revokedAt: userApiTokens.revokedAt,
      expiresAt: userApiTokens.expiresAt,
    })
    .from(userApiTokens)
    .where(and(eq(userApiTokens.id, tokenId), eq(userApiTokens.userId, userId)))
    .limit(1);
  if (!row) throw new AgentApiError(404, 'not_found', 'No se ha encontrado la clave.');
  const expired = Boolean(row.expiresAt && row.expiresAt.getTime() <= Date.now());
  if (!row.revokedAt && !expired) {
    throw new AgentApiError(400, 'not_revoked', 'Revoca la clave antes de quitarla de la lista.');
  }
  await db.delete(userApiTokens).where(and(
    eq(userApiTokens.id, tokenId),
    eq(userApiTokens.userId, userId),
  ));
  return { id: row.id };
}
