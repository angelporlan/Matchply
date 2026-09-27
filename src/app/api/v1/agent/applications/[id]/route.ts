import { NextRequest } from 'next/server';
import { getAgentApplication, updateAgentApplication } from '@/lib/agent-api/applications';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

const APPLICATION_MAX_BYTES = 220_000;

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'applications:read', async (auth) => {
    const data = await getAgentApplication(auth.userId, params.id);
    return { data };
  }, { read: true });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'applications:write', async (auth) => {
    const body = await readAgentBody(req, APPLICATION_MAX_BYTES);
    const result = await updateAgentApplication(auth.userId, params.id, body);
    await createAuditLog('agent_application_updated', auth.userId, auth.email, {
      offerId: result.data.id,
      title: result.data.title,
      company: result.data.company,
      updatedFields: result.changed,
      apiKeyId: auth.tokenId,
    });
    return { data: result.data };
  });
}

export const dynamic = 'force-dynamic';
