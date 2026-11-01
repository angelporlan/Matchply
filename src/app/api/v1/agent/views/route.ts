import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAgentView, listAgentViews } from '@/lib/agent-api/views';
import { createAuditLog } from '@/lib/audit';

const MAX_BYTES = 64_000;

export async function GET(req: NextRequest) {
  return handleAgent(req, 'views:read', async (auth) => {
    return listAgentViews(auth.userId, req.nextUrl.searchParams.get('entity'));
  }, { read: true });
}

export async function POST(req: NextRequest) {
  return handleAgent(req, 'views:write', async (auth) => {
    const body = await readAgentBody(req, MAX_BYTES);
    const result = await createAgentView(auth.userId, body);
    await createAuditLog('agent_view_created', auth.userId, auth.email, {
      viewId: result.data.id,
      entity: result.data.entity,
      name: result.data.name,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
