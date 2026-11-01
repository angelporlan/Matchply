import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { setAgentViewDefault } from '@/lib/agent-api/views';
import { createAuditLog } from '@/lib/audit';

type Context = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'views:write', async (auth) => {
    const body = await readAgentBody(req, 8_000);
    const result = await setAgentViewDefault(auth.userId, params.id, body);
    await createAuditLog('agent_view_default_set', auth.userId, auth.email, {
      viewId: params.id,
      isDefault: result.data.isDefault,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
