import { NextRequest } from 'next/server';
import { createAgentCompanyNote, listAgentCompanyNotes } from '@/lib/agent-api/companies';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'companies:read', async (auth) => listAgentCompanyNotes(auth.userId, params.id), { read: true });
}

export async function POST(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'companies:write', async (auth) => {
    const body = await readAgentBody(req, 16_000);
    const result = await createAgentCompanyNote(auth.userId, params.id, body);
    await createAuditLog('agent_company_note_created', auth.userId, auth.email, {
      companyId: params.id,
      noteId: result.data.id,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
