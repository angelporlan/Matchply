import { NextRequest } from 'next/server';
import { createAuditLog } from '@/lib/audit';
import { claimExtensionPairingCode, ExtensionAuthError } from '@/lib/extension-auth';
import { extensionJson, extensionOptions } from '@/lib/extension-http';

export async function OPTIONS() {
  return extensionOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await claimExtensionPairingCode(body?.code, body?.extensionVersion);
    await createAuditLog('extension_pairing_claimed', result.installation.userId, null, {
      installationId: result.installation.id,
    });
    return extensionJson({
      success: true,
      scope: 'linkedin:ingest',
      token: result.token,
      installation: result.installation,
    });
  } catch (error) {
    if (error instanceof ExtensionAuthError) return extensionJson({ error: error.message }, { status: error.status });
    return extensionJson({ error: error instanceof Error ? error.message : 'Invalid pairing request' }, { status: 400 });
  }
}
