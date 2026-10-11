'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isUmamiDoNotTrack, shouldTrackUmamiPath, type UmamiConversionEvent } from '@/lib/umami';
import { createUmamiClient, type UmamiPayload } from '@/lib/umami-client';
import type { LandingExperiment, LandingExperimentStage, LandingVariant } from '@/lib/landing-experiment';

declare global {
  interface Window {
    umami?: {
      track: (event: string | Record<string, unknown> | ((base: UmamiPayload) => UmamiPayload)) => unknown;
    };
    doNotTrack?: string | number;
  }
}

let client: ReturnType<typeof createUmamiClient> | null = null;

function browserClient() {
  if (typeof window === 'undefined') return null;
  if (!client) {
    client = createUmamiClient({
      page: () => ({
        pathname: window.location.pathname,
        title: document.title,
        referrer: document.referrer,
        doNotTrack: isUmamiDoNotTrack(navigator.doNotTrack) || isUmamiDoNotTrack(window.doNotTrack)
          || isUmamiDoNotTrack((navigator as Navigator & { msDoNotTrack?: string | number }).msDoNotTrack),
      }),
      transport: () => window.umami?.track.bind(window.umami),
      storage: () => {
        try { return window.sessionStorage; } catch { return null; }
      },
    });
  }
  return client;
}

export function trackUmamiConversion(event: UmamiConversionEvent) {
  return browserClient()?.conversion(event) ?? false;
}

export function trackLandingExperiment(stage: LandingExperimentStage, expectedVariant?: LandingVariant) {
  return browserClient()?.experiment(stage, expectedVariant) ?? false;
}

export function syncLandingExperiment(experiment: LandingExperiment) {
  browserClient()?.setExperiment(experiment);
}

export default function UmamiTracker({
  enabled,
  websiteId,
  scriptUrl,
  impersonating,
  administrator = false,
  experiment = { variant: null, enabled: false },
}: {
  enabled: boolean;
  websiteId: string;
  scriptUrl: string;
  impersonating: boolean;
  administrator?: boolean;
  experiment?: LandingExperiment;
}) {
  const pathname = usePathname();
  const canTrack = enabled && !administrator && !impersonating
    && Boolean(websiteId && scriptUrl) && shouldTrackUmamiPath(pathname || '/');

  useEffect(() => {
    const dispatcher = browserClient();
    dispatcher?.configure({ enabled: canTrack, administrator, impersonating, experiment });
  }, [canTrack, administrator, impersonating, experiment]);

  useEffect(() => {
    browserClient()?.pageview();
  }, [canTrack, pathname]);

  if (!canTrack) return null;

  // Pinned v2.18.1 exposes the manual API with automatic initialization disabled.
  // auto-pageview was added in v3.2; v2 needs auto-track=false to avoid raw pageviews.
  return (
    <Script
      id="matchply-umami"
      defer
      src={scriptUrl}
      data-website-id={websiteId}
      data-auto-track="false"
      data-auto-pageview="false"
      data-do-not-track="true"
      data-exclude-search="true"
      onReady={() => {
        browserClient()?.flush();
        browserClient()?.pageview();
        window.dispatchEvent(new Event('matchply:umami-ready'));
      }}
    />
  );
}
