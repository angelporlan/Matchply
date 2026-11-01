import { NextRequest } from 'next/server';
import { setAgentFavorites } from '@/lib/agent-api/applications';
import { agentErrorResponse, agentJson, readAgentBody } from '@/lib/agent-api/http';
import { parseFavoritesBody } from '@/lib/agent-api/validate';
import type { AgentScope } from '@/lib/agent-api/scopes';
import { authenticateAgentRequest, requireAgentScope } from '@/lib/api-key-auth';
import { createAuditLog } from '@/lib/audit';
import type { CrmEntity } from '@/lib/crm-views';

function writeScope(entity: CrmEntity): AgentScope {
  if (entity === 'companies') return 'companies:write';
  if (entity === 'people') return 'people:write';
  return 'applications:write';
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateAgentRequest(req);
    const body = await readAgentBody(req, 64_000);
    const input = parseFavoritesBody(body);
    requireAgentScope(auth, writeScope(input.entity));
    const result = await setAgentFavorites(auth.userId, body);
    await createAuditLog('agent_favorites_set', auth.userId, auth.email, {
      entity: input.entity,
      count: result.updatedCount,
      isFavorite: result.isFavorite,
      apiKeyId: auth.tokenId,
    });
    return agentJson({ data: result });
  } catch (error) {
    return agentErrorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
