import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { batchSetAgentPeopleStatus } from '@/lib/agent-api/people';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  return handleAgent(req, 'people:write', async (auth) => {
    const body = await readAgentBody(req, 64_000);
    const result = await batchSetAgentPeopleStatus(auth.userId, body);
    await createAuditLog('agent_people_status_batch', auth.userId, auth.email, {
      count: result.updatedCount,
      status: result.status,
      apiKeyId: auth.tokenId,
    });
    return { data: result };
  });
}

export const dynamic = 'force-dynamic';
