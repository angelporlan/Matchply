import { NextRequest } from 'next/server';
import { createAgentApplication, listAgentApplications } from '@/lib/agent-api/applications';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { parseLimit } from '@/lib/agent-api/validate';
import { createAuditLog } from '@/lib/audit';

const APPLICATION_MAX_BYTES = 220_000;

export async function GET(req: NextRequest) {
  return handleAgent(req, 'applications:read', async (auth) => {
    const params = req.nextUrl.searchParams;
    return listAgentApplications(auth.userId, {
      status: params.get('status'),
      limit: parseLimit(params.get('limit')),
      cursor: params.get('cursor'),
    });
  }, { read: true });
}

export async function POST(req: NextRequest) {
  return handleAgent(req, 'applications:write', async (auth) => {
    const body = await readAgentBody(req, APPLICATION_MAX_BYTES);
    const result = await createAgentApplication(auth.userId, body);
    if (result.created) {
      await createAuditLog('agent_application_created', auth.userId, auth.email, {
        offerId: result.data.id,
        title: result.data.title,
        company: result.data.company,
        platform: result.data.platform,
        apiKeyId: auth.tokenId,
      });
    }
    return { data: result.data, created: result.created };
  });
}

export const dynamic = 'force-dynamic';
