import { NextRequest } from 'next/server';
import { handleAgent } from '@/lib/agent-api/http';
import { queryAgentSystemRows } from '@/lib/agent-api/views';

export async function GET(req: NextRequest) {
  return handleAgent(req, 'views:read', async (auth) => {
    const params = req.nextUrl.searchParams;
    return queryAgentSystemRows(auth.userId, params.get('entity'), params.get('id'), params.get('page'));
  }, { read: true });
}

export const dynamic = 'force-dynamic';
