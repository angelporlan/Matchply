import { NextResponse } from 'next/server';
import { requireAccountContext } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import { deleteRevokedExtensionInstallation, ExtensionAuthError, revealExtensionInstallationToken, revokeExtensionInstallation } from '@/lib/extension-auth';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user: { id: string; email: string | null };
  try {
    const ctx = await requireAccountContext();
    user = { id: ctx.realUser!.id, email: ctx.realUser!.email || null };
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const token = await revealExtensionInstallationToken(user.id, params.id);
    const response = NextResponse.json({ token });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    if (error instanceof ExtensionAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let user: { id: string; email: string | null };
  try {
    const ctx = await requireAccountContext();
    user = { id: ctx.realUser!.id, email: ctx.realUser!.email || null };
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const remove = new URL(req.url).searchParams.get('remove') === '1';
  try {
    if (remove) {
      const result = await deleteRevokedExtensionInstallation(user.id, params.id);
      await createAuditLog('extension_installation_deleted', user.id, user.email, {
        installationId: result.id,
      });
      return NextResponse.json({ success: true, id: result.id });
    }
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
