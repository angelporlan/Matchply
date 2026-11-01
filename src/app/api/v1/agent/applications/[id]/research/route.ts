import { revalidatePath } from 'next/cache';
import { NextRequest } from 'next/server';
import { enqueueAgentResearch, readAgentResearch } from '@/lib/agent-api/research';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

const RESEARCH_MAX_BYTES = 4_000;

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'applications:read', async (auth) => {
    const data = await readAgentResearch(auth.userId, params.id);
    return { data };
  }, { read: true });
}

export async function POST(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'applications:write', async (auth) => {
    const body = await readAgentBody(req, RESEARCH_MAX_BYTES);
    const result = await enqueueAgentResearch(auth.userId, params.id, body);
    await createAuditLog('agent_research_requested', auth.userId, auth.email, {
      offerId: params.id,
      runId: result.runId,
      status: result.status,
      alreadyExists: result.alreadyExists,
      apiKeyId: auth.tokenId,
    });
    revalidatePath('/dashboard/applications');
    revalidatePath(`/dashboard/applications/offer/${params.id}`);
    return { data: result };
  });
}

export const dynamic = 'force-dynamic';
