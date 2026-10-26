import { log } from '@/lib/logger';
import { publicErrorBody } from '@/lib/public-errors';
import { NextRequest, NextResponse } from 'next/server';
import { requireAccountContext } from '@/lib/request-context';
import { createAuditLog } from '@/lib/audit';
import {
  createExtensionPairingCode,
  ExtensionAuthError,
  listExtensionInstallations,
  publicExtensionInstallation,
} from '@/lib/extension-auth';
import { SubscriptionAccessError } from '@/lib/permissions';

async function currentUser() {
  try {
    const ctx = await requireAccountContext();
    return { id: ctx.realUser!.id, email: ctx.realUser!.email || null };
  } catch {
    return null;
  }
}

function errorResponse(error: unknown) {
  if (error instanceof ExtensionAuthError || error instanceof SubscriptionAccessError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ ...publicErrorBody(error) }, { status: 500 });
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const installations = await listExtensionInstallations(user.id);
    return NextResponse.json({ installations: installations.map(publicExtensionInstallation) });
  } catch (error) {
    log({ event: 'extension_request_failed', level: 'error', error });
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const pairing = await createExtensionPairingCode(user.id);
    await createAuditLog('extension_pairing_code_created', user.id, user.email, { pairingId: pairing.id });
    return NextResponse.json({
      success: true,
      pairing: {
        id: pairing.id,
        code: pairing.code,
        expiresAt: pairing.expiresAt,
        extensionVersion: typeof body.extensionVersion === 'string' ? body.extensionVersion.slice(0, 40) : null,
      },
    });
  } catch (error) {
    log({ event: 'extension_request_failed', level: 'error', error });
    return errorResponse(error);
  }
}

export const dynamic = 'force-dynamic';
