'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  shouldTrackUmamiPath,
  umamiPagePayload,
  type UmamiConversionEvent,
} from '@/lib/umami';

declare global {
  interface Window {
    umami?: {
      track: (event: string | Record<string, string>) => void;
    };
  }
}

export function trackUmamiConversion(event: UmamiConversionEvent) {
  if (typeof window === 'undefined') return;
  window.umami?.track(event);
}

export default function UmamiTracker({
  enabled,
  websiteId,
  scriptUrl,
  impersonating,
}: {
  enabled: boolean;
  websiteId: string;
  scriptUrl: string;
  impersonating: boolean;
}) {
  const pathname = usePathname();
  const canTrack = enabled && !impersonating && Boolean(websiteId && scriptUrl) && shouldTrackUmamiPath(pathname || '/');

  useEffect(() => {
    if (!canTrack) return;
    const payload = umamiPagePayload({
      pathname: pathname || '/',
      title: typeof document !== 'undefined' ? document.title : '',
      referrer: typeof document !== 'undefined' ? document.referrer : '',
    });
    window.umami?.track({
      url: payload.url,
      title: payload.title,
      referrer: payload.referrer,
    });
  }, [canTrack, pathname]);

  if (!canTrack) return null;

  return (
    <Script
      defer
      src={scriptUrl}
      data-website-id={websiteId}
      data-auto-track="false"
      data-do-not-track="true"
      data-exclude-search="true"
    />
  );
}
