'use client';

import { useEffect } from 'react';
import { trackUmamiConversion } from '@/components/analytics/UmamiTracker';

const COOKIE = 'matchply_signup_completed';

function hasSignupCookie() {
  return document.cookie.split('; ').some((row) => row.startsWith(`${COOKIE}=`));
}

/** Fires once after a Google signup. The auth callback sets the cookie; email signup tracks itself. */
export function SignupConversionBeacon() {
  useEffect(() => {
    if (!hasSignupCookie()) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (!hasSignupCookie()) {
        window.clearInterval(timer);
        return;
      }
      if (window.umami?.track && trackUmamiConversion('signup_completed')) {
        document.cookie = `${COOKIE}=; Max-Age=0; path=/`;
        window.clearInterval(timer);
        return;
      }
      if (attempts >= 20) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
