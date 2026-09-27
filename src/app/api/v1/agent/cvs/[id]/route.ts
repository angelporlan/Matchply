import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { getAgentCv, updateAgentCv } from '@/lib/agent-api/cvs';
import { createAuditLog } from '@/lib/audit';

const CV_MAX_BYTES = 450_000;

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'cv:read', async (auth) => {
    const data = await getAgentCv(auth.userId, params.id);
    return { data };
  }, { read: true });
}

export async function PUT(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'cv:write', async (auth) => {
    const body = await readAgentBody(req, CV_MAX_BYTES);
    const updated = await updateAgentCv(auth, params.id, body);
    await createAuditLog('agent_cv_updated', auth.userId, auth.email, {
      cvId: updated.id,
      updatedFields: updated.updatedFields,
      apiKeyId: auth.tokenId,
    });
    return {
      data: {
        id: updated.id,
        title: updated.title,
        isBase: updated.isBase,
        isPrincipal: updated.isPrincipal,
      },
    };
  });
}

export const dynamic = 'force-dynamic';
