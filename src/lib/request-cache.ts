import * as React from 'react';

type AnyFn = (...args: any[]) => any;

/**
 * Per-request memoization. Inside Next.js (RSC, Server Actions, Route Handlers)
 * this is React's `cache`, so layout + page + nested helpers share one result.
 * Outside a React request (workers, tsx scripts, tests) React 18 stable has no
 * `cache`, so we fall back to the plain function.
 */
export function requestCache<T extends AnyFn>(fn: T): T {
  const reactCache = (React as unknown as { cache?: <F extends AnyFn>(f: F) => F }).cache;
  return typeof reactCache === 'function' ? reactCache(fn) : fn;
}
