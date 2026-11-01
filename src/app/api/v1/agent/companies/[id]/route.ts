import { NextRequest } from 'next/server';
import { deleteAgentCompany, getAgentCompany, updateAgentCompany } from '@/lib/agent-api/companies';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'companies:read', async (auth) => getAgentCompany(auth.userId, params.id), { read: true });
}

export async function PATCH(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'companies:write', async (auth) => {
    const body = await readAgentBody(req, 16_000);
    const result = await updateAgentCompany(auth.userId, params.id, body);
    await createAuditLog('agent_company_updated', auth.userId, auth.email, {
      companyId: params.id,
      name: result.data.name,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export async function DELETE(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'companies:write', async (auth) => {
    const result = await deleteAgentCompany(auth.userId, params.id);
    await createAuditLog('agent_company_deleted', auth.userId, auth.email, {
      companyId: params.id,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
