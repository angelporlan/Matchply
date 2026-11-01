import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { deleteAgentView, getAgentView, updateAgentView } from '@/lib/agent-api/views';
import { createAuditLog } from '@/lib/audit';

const MAX_BYTES = 64_000;
type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'views:read', async (auth) => getAgentView(auth.userId, params.id), { read: true });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'views:write', async (auth) => {
    const body = await readAgentBody(req, MAX_BYTES);
    const result = await updateAgentView(auth.userId, params.id, body);
    await createAuditLog('agent_view_updated', auth.userId, auth.email, {
      viewId: result.data.id,
      entity: result.data.entity,
      name: result.data.name,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'views:write', async (auth) => {
    const result = await deleteAgentView(auth.userId, params.id);
    await createAuditLog('agent_view_deleted', auth.userId, auth.email, {
      viewId: params.id,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
