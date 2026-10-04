'use client';

import { useEffect, useRef } from 'react';
import { syncLandingExperiment, trackLandingExperiment } from '@/components/analytics/UmamiTracker';
import type { LandingExperiment } from '@/lib/landing-experiment';

export default function LandingExperimentBeacon({ experiment }: { experiment: LandingExperiment }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // The root layout persists when the first landing visit comes from another app route.
    syncLandingExperiment(experiment);
    if (!experiment.enabled || !experiment.variant || !marker.current) return;
    let visible = false;
    const expose = () => {
      if (visible && document.visibilityState === 'visible' && window.location.pathname === '/') {
        trackLandingExperiment('exposed', experiment.variant!);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      expose();
    });
    observer.observe(marker.current);
    document.addEventListener('visibilitychange', expose);
    window.addEventListener('matchply:umami-ready', expose);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', expose);
      window.removeEventListener('matchply:umami-ready', expose);
    };
  }, [experiment]);

  return <span ref={marker} aria-hidden="true" className="pointer-events-none absolute h-px w-px" />;
}
