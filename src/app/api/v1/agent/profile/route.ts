import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { getAgentProfile, updateAgentProfile } from '@/lib/agent-api/profile';
import { createAuditLog } from '@/lib/audit';

const PROFILE_MAX_BYTES = 80_000;

export async function GET(req: NextRequest) {
  return handleAgent(req, 'profile:read', async (auth) => {
    const profile = await getAgentProfile(auth.userId);
    return { data: { ...profile, scopes: auth.scopes } };
  }, { read: true });
}

export async function PATCH(req: NextRequest) {
  return handleAgent(req, 'profile:write', async (auth) => {
    const body = await readAgentBody(req, PROFILE_MAX_BYTES);
    const result = await updateAgentProfile(auth.userId, body);
    await createAuditLog('agent_profile_updated', auth.userId, auth.email, {
      ...result.audit,
      apiKeyId: auth.tokenId,
    });
    return { data: { ...result.data, scopes: auth.scopes } };
  });
}

export const dynamic = 'force-dynamic';
