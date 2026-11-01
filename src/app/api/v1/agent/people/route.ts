import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAgentPerson, listAgentPeople } from '@/lib/agent-api/people';
import { createAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  return handleAgent(req, 'people:read', async (auth) => {
    const params = req.nextUrl.searchParams;
    return listAgentPeople(auth.userId, {
      query: params.get('query'),
      status: params.get('status'),
      page: params.get('page'),
    });
  }, { read: true });
}

export async function POST(req: NextRequest) {
  return handleAgent(req, 'people:write', async (auth) => {
    const body = await readAgentBody(req, 64_000);
    const result = await createAgentPerson(auth.userId, body);
    await createAuditLog('agent_person_saved', auth.userId, auth.email, {
      personId: result.data.id,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
