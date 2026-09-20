'use client';

import { useEffect } from 'react';
import { ACTOR_EPOCH_HEADER } from '@/lib/impersonation';

export default function ActorEpochGuard({ epoch }: { epoch: string }) {
  useEffect(() => {
    document.documentElement.dataset.mpEpoch = epoch;
    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const isAction = headers.has('Next-Action') || headers.has('next-action');
      if (isAction || (typeof init?.method === 'string' && init.method.toUpperCase() !== 'GET')) {
        headers.set(ACTOR_EPOCH_HEADER, epoch);
      }
      return original(input, { ...init, headers });
    };

    const channel = 'mp-actor-epoch';
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel(channel) : null;
    bc?.postMessage(epoch);
    const onMessage = (event: MessageEvent) => {
      if (event.data && event.data !== epoch) window.location.reload();
    };
    bc?.addEventListener('message', onMessage);

    const onFocus = () => {
      const current = document.documentElement.dataset.mpEpoch;
      if (current && current !== epoch) window.location.reload();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      window.fetch = original;
      bc?.removeEventListener('message', onMessage);
      bc?.close();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [epoch]);

  return null;
}
