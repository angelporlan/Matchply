import { NextRequest } from 'next/server';
import { deleteAgentCompanyNote } from '@/lib/agent-api/companies';
import { handleAgent } from '@/lib/agent-api/http';
import { createAuditLog } from '@/lib/audit';

type Context = { params: { noteId: string } };

export async function DELETE(req: NextRequest, { params }: Context) {
  return handleAgent(req, 'companies:write', async (auth) => {
    const result = await deleteAgentCompanyNote(auth.userId, params.noteId);
    await createAuditLog('agent_company_note_deleted', auth.userId, auth.email, {
      noteId: params.noteId,
      apiKeyId: auth.tokenId,
    });
    return result;
  });
}

export const dynamic = 'force-dynamic';
