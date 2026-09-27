import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAgentCv, listAgentCvs } from '@/lib/agent-api/cvs';
import { parseLimit } from '@/lib/agent-api/validate';
import { createAuditLog } from '@/lib/audit';

const CV_MAX_BYTES = 450_000;

export async function GET(req: NextRequest) {
  return handleAgent(req, 'cv:read', async (auth) => {
    const limit = parseLimit(req.nextUrl.searchParams.get('limit'));
    const data = await listAgentCvs(auth.userId, limit);
    return { data };
  }, { read: true });
}

export async function POST(req: NextRequest) {
  return handleAgent(req, 'cv:write', async (auth) => {
    const body = await readAgentBody(req, CV_MAX_BYTES);
    const created = await createAgentCv(auth, body);
    await createAuditLog('agent_cv_created', auth.userId, auth.email, {
      cvId: created.id,
      title: created.title,
      apiKeyId: auth.tokenId,
    });
    return { data: created, created: true };
  });
}

export const dynamic = 'force-dynamic';
