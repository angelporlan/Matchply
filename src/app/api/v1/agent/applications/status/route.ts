import { NextRequest } from 'next/server';
import { batchSetApplicationStatus } from '@/lib/agent-api/applications';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  return handleAgent(req, 'applications:write', async (auth) => {
    const body = await readAgentBody(req, 64_000);
    const result = await batchSetApplicationStatus(auth.userId, body);
    await createAuditLog('agent_applications_status_batch', auth.userId, auth.email, {
      count: result.updatedCount,
      status: result.status,
      apiKeyId: auth.tokenId,
    });
    return { data: result };
  });
}

export const dynamic = 'force-dynamic';
