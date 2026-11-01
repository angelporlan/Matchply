import { NextRequest } from 'next/server';
import { handleAgent } from '@/lib/agent-api/http';
import { queryAgentViewRows } from '@/lib/agent-api/views';

type Context = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'views:read', async (auth) => {
    return queryAgentViewRows(auth.userId, params.id, req.nextUrl.searchParams.get('page'));
  }, { read: true });
}

export const dynamic = 'force-dynamic';
