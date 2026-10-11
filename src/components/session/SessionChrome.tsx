import ActorEpochGuard from '@/components/session/ActorEpochGuard';
import ImpersonationBanner from '@/components/session/ImpersonationBanner';
import UmamiTracker from '@/components/analytics/UmamiTracker';
import { SignupConversionBeacon } from '@/components/analytics/SignupConversionBeacon';
import { getRequestContext } from '@/lib/request-context';
import { isUmamiCollectionEnabled } from '@/lib/flags';
import { headers } from 'next/headers';
import { readLandingExperiment } from '@/lib/landing-experiment-server';
import { isUmamiDoNotTrack } from '@/lib/umami';

export default async function SessionChrome({ children }: { children: React.ReactNode }) {
  const ctx = await getRequestContext();
  const experiment = await readLandingExperiment();
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
        enabled={isUmamiCollectionEnabled() && !isUmamiDoNotTrack(headers().get('dnt'))}
        websiteId={process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || process.env.UMAMI_WEBSITE_ID || ''}
        scriptUrl={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || ''}
        impersonating={Boolean(ctx.impersonation)}
        administrator={ctx.realUser?.role === 'admin' || ctx.impersonationInvalid}
        experiment={experiment}
      />
      <SignupConversionBeacon />
      {children}
    </>
  );
}
