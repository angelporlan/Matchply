import { NextRequest } from 'next/server';
import { extensionJson, extensionOptions } from '@/lib/extension-http';
import { ExtensionAuthError, resolveExtensionSession } from '@/lib/extension-auth';
import { isProSubscription } from '@/lib/subscription';

export async function OPTIONS() {
  return extensionOptions();
}

export async function GET(req: NextRequest) {
  try {
    const session = await resolveExtensionSession(req);
    return extensionJson({
      connected: true,
      scope: session.scope,
      installation: {
        id: session.installation.id,
        status: session.installation.status,
        extensionVersion: session.installation.extensionVersion,
        expiresAt: session.installation.expiresAt,
        lastSeenAt: session.installation.lastSeenAt,
        lastCaptureAt: session.installation.lastCaptureAt,
      },
      canResearch: isProSubscription(session.user.subscriptionStatus),
    });
  } catch (error) {
    if (error instanceof ExtensionAuthError) return extensionJson({ connected: false, error: error.message }, { status: error.status });
    return extensionJson({ connected: false, error: 'Unable to read extension status' }, { status: 500 });
  }
}
