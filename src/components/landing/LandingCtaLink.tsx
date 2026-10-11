'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trackLandingExperiment } from '@/components/analytics/UmamiTracker';

export default function LandingCtaLink({ href, children, className, id, ariaLabel }: {
  href: string;
  children: ReactNode;
  className?: string;
  id?: string;
  ariaLabel?: string;
}) {
  return (
    <Link href={href} className={className} id={id} aria-label={ariaLabel} prefetch={false}
      onClick={() => trackLandingExperiment('cta')}>
      {children}
    </Link>
  );
}
