import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createAuditLog } from '@/lib/audit';
import { ExtensionAuthError, revokeExtensionInstallation } from '@/lib/extension-auth';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const result = await revokeExtensionInstallation(session.user.id, params.id);
    await createAuditLog('extension_installation_revoked', session.user.id, session.user.email || null, {
      installationId: result.id,
    });
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    if (error instanceof ExtensionAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
