import { NextResponse } from 'next/server';
import { requireAccountContext } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { ExtensionAuthError, revokeExtensionInstallation } from '@/lib/extension-auth';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user: { id: string; email: string | null };
  try {
    const ctx = await requireAccountContext();
    user = { id: ctx.realUser!.id, email: ctx.realUser!.email || null };
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const result = await revokeExtensionInstallation(user.id, params.id);
    await createAuditLog('extension_installation_revoked', user.id, user.email, {
      installationId: result.id,
    });
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    if (error instanceof ExtensionAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
