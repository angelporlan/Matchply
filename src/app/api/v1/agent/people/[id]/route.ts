import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { deleteAgentPerson, getAgentPerson, updateAgentPerson } from '@/lib/agent-api/people';
import { createAuditLog } from '@/lib/audit';

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'people:read', async (auth) => getAgentPerson(auth.userId, params.id), { read: true });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'people:write', async (auth) => {
    const body = await readAgentBody(req, 64_000);
    const result = await updateAgentPerson(auth.userId, params.id, body);
    await createAuditLog('agent_person_saved', auth.userId, auth.email, {
      personId: params.id,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'people:write', async (auth) => {
    const result = await deleteAgentPerson(auth.userId, params.id);
    await createAuditLog('agent_person_deleted', auth.userId, auth.email, {
      personId: params.id,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
