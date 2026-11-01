import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { linkAgentPersonOffer } from '@/lib/agent-api/people';
import { createAuditLog } from '@/lib/audit';

type Context = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'people:write', async (auth) => {
    const body = await readAgentBody(req, 8_000);
    const result = await linkAgentPersonOffer(auth.userId, params.id, body);
    await createAuditLog('agent_person_linked', auth.userId, auth.email, {
      personId: params.id,
      offerId: result.data.offerId,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
