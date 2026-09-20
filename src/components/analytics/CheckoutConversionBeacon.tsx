'use client';

import { useEffect } from 'react';
import { trackUmamiConversion } from '@/components/analytics/UmamiTracker';

export default function CheckoutConversionBeacon({ checkout }: { checkout?: string }) {
  useEffect(() => {
    if (checkout === 'success') trackUmamiConversion('trial_started');
  }, [checkout]);
  return null;
}
