import ActorEpochGuard from '@/components/session/ActorEpochGuard';
import ImpersonationBanner from '@/components/session/ImpersonationBanner';
import UmamiTracker from '@/components/analytics/UmamiTracker';
import { getRequestContext } from '@/lib/request-context';
import { isUmamiCollectionEnabled } from '@/lib/flags';

export default async function SessionChrome({ children }: { children: React.ReactNode }) {
  const ctx = await getRequestContext();
  return (
    <>
      <ActorEpochGuard epoch={ctx.actorEpoch} />
      {ctx.impersonation && ctx.effectiveUser && (
        <ImpersonationBanner
          targetName={ctx.effectiveUser.name}
          targetEmail={ctx.effectiveUser.email}
          expiresAt={ctx.impersonation.expiresAt.toISOString()}
        />
      )}
      <UmamiTracker
        enabled={isUmamiCollectionEnabled()}
        websiteId={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || process.env.UMAMI_WEBSITE_ID || ''}
        scriptUrl={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || ''}
        impersonating={Boolean(ctx.impersonation)}
      />
      {children}
    </>
  );
}
