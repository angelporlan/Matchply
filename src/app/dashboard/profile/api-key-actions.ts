'use server';

import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';
import { AgentApiError } from '@/lib/agent-api/errors';
import { createUserApiToken, revokeUserApiToken } from '@/lib/agent-api/tokens';
import type { AgentScope } from '@/lib/agent-api/scopes';
import { parseApiTokenName } from '@/lib/agent-api/validate';
import { parseApiTokenScopes } from '@/lib/api-key-auth';
import { consumeRateLimit, RateLimitError } from '@/lib/rate-limit';
import {
  AccountSuspendedError,
  SupportActionBlockedError,
} from '@/lib/request-errors';
import { requireAccountContext } from '@/lib/request-context';
import { SubscriptionAccessError } from '@/lib/permissions';
import { canAccessFeature } from '@/lib/subscription';

function actionError(error: unknown): { error: string } {
  if (error instanceof AgentApiError) return { error: error.code };
  if (error instanceof SubscriptionAccessError) return { error: 'subscription_required' };
  if (error instanceof RateLimitError) return { error: 'rate_limited' };
  if (error instanceof AccountSuspendedError || error instanceof SupportActionBlockedError) return { error: 'forbidden' };
  if (error instanceof Error && error.message === 'Unauthorized') return { error: 'unauthorized' };
  return { error: 'generic' };
}

async function requireApiKeyOwner() {
  const ctx = await requireAccountContext();
  const user = ctx.realUser;
  if (user.isGuest || !canAccessFeature(user.subscriptionStatus, 'agentApi', {
    isGuest: user.isGuest,
    proGrantedUntil: user.proGrantedUntil,
  })) {
    throw new SubscriptionAccessError('agentApi');
  }
  return user;
}

export async function createApiKeyAction(input: { name: string; scopes: string[] }) {
  try {
    const user = await requireApiKeyOwner();
    consumeRateLimit(`agent:mint:${user.id}`, 5, 10 * 60_000);
    const name = parseApiTokenName(input?.name);
    const scopes = parseApiTokenScopes(input?.scopes) as AgentScope[];
    const created = await createUserApiToken(user.id, name, scopes);
    await createAuditLog('api_key_created', user.id, user.email, {
      apiKeyId: created.apiToken.id,
      name: created.apiToken.name,
      scopes: created.apiToken.scopes,
    });
    revalidatePath('/dashboard/profile');
    return { success: true as const, token: created.token, apiToken: created.apiToken };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeApiKeyAction(tokenId: string) {
  try {
    const user = await requireApiKeyOwner();
    const revoked = await revokeUserApiToken(user.id, tokenId);
    await createAuditLog('api_key_revoked', user.id, user.email, { apiKeyId: revoked.id });
    revalidatePath('/dashboard/profile');
    return { success: true as const, id: revoked.id };
  } catch (error) {
    return actionError(error);
  }
}
