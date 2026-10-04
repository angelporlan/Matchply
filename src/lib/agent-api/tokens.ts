import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { userApiTokens } from '@/db/schema';
import { AgentApiError } from '@/lib/agent-api/errors';
import {
  type AgentScope,
  type ApiTokenView,
  isAgentScope,
} from '@/lib/agent-api/scopes';
import { isUuid } from '@/lib/agent-api/validate';
import { generateApiToken } from '@/lib/api-key-auth';
import { lockCvUser } from '@/lib/cv-access';
import { getUserPlan } from '@/lib/plan-store';

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
    .select(tokenColumns)
    .from(userApiTokens)
    .where(eq(userApiTokens.userId, userId))
    .orderBy(desc(userApiTokens.createdAt));
  return rows.map((row) => toView(row, false));
}

export async function createUserApiToken(userId: string, name: string, scopes: AgentScope[]) {
  return db.transaction(async tx => {
    await lockCvUser(tx, userId);
    const { limits } = await getUserPlan(userId, tx);
    if (!limits.apiKeys) throw new AgentApiError(403, 'subscription_required', 'Tu plan no permite claves de agente.');
    const [countRow] = await tx.select({ count: sql<number>`cast(count(*) as int)` }).from(userApiTokens).where(and(eq(userApiTokens.userId, userId), isNull(userApiTokens.revokedAt), sql`(${userApiTokens.expiresAt} is null or ${userApiTokens.expiresAt} > now())`));
    if (countRow.count >= limits.apiKeys) throw new AgentApiError(400, 'too_many_keys', `Has alcanzado el límite de ${limits.apiKeys} claves activas. Revoca una para crear otra.`);
    const generated = generateApiToken();
    const [created] = await tx.insert(userApiTokens).values({ userId, name, tokenHash: generated.tokenHash, lastChars: generated.lastChars, scopes }).returning(tokenColumns);
    return { token: generated.token, apiToken: toView(created, false) };
  });
}

export async function revealUserApiToken(_userId: string, _tokenId: string): Promise<string> {
  throw new AgentApiError(409, 'token_unavailable', 'Las claves solo se muestran al crearlas. Revoca esta clave y crea otra si necesitas un nuevo token.');
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
