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
}): ApiTokenView {
  return {
    id: row.id,
    name: row.name,
    lastChars: row.lastChars,
    scopes: viewScopes(row.scopes),
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
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
  return rows.map(toView);
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
      lastChars: generated.lastChars,
      scopes,
    })
    .returning(tokenColumns);

  return { token: generated.token, apiToken: toView(created) };
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
