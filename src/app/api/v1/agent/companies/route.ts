import { NextRequest } from 'next/server';
import { createAgentCompany, listAgentCompanies } from '@/lib/agent-api/companies';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  return handleAgent(req, 'companies:read', async (auth) => listAgentCompanies(auth.userId), { read: true });
}

export async function POST(req: NextRequest) {
  return handleAgent(req, 'companies:write', async (auth) => {
    const body = await readAgentBody(req, 16_000);
    const result = await createAgentCompany(auth.userId, body);
    await createAuditLog('agent_company_created', auth.userId, auth.email, {
      companyId: result.data.id,
      name: result.data.name,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
