import { NextRequest } from 'next/server';
import { batchEvaluateAgentApplications } from '@/lib/agent-api/applications';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

const APPLICATION_MAX_BYTES = 220_000;

export async function POST(req: NextRequest) {
  return handleAgent(req, 'applications:write', async (auth) => {
    const body = await readAgentBody(req, APPLICATION_MAX_BYTES);
    const result = await batchEvaluateAgentApplications(auth.userId, body);
    await createAuditLog('agent_applications_batch_evaluated', auth.userId, auth.email, {
      count: result.updatedCount,
      apiKeyId: auth.tokenId,
    });
    return { data: { updatedCount: result.updatedCount } };
  });
}

export const dynamic = 'force-dynamic';
