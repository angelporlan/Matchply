import { NextRequest } from 'next/server';
import { handleAgent, readAgentBody } from '@/lib/agent-api/http';
import { previewAgentView } from '@/lib/agent-api/views';

export async function POST(req: NextRequest) {
  return handleAgent(req, 'views:read', async (auth) => {
    const body = await readAgentBody(req, 64_000);
    return previewAgentView(auth.userId, body);
  }, { read: true });
}

export const dynamic = 'force-dynamic';
