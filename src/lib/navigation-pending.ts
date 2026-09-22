export const NAV_SLOW_MS = 3_000;
export const NAV_STUCK_MS = 15_000;

export function isModifiedNavigationClick(event: {
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}) {
  return Boolean(
    event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
    || (event.button !== undefined && event.button !== 0),
  );
}

export function splitHref(href: string) {
  const [pathAndQuery] = href.split('#');
  const q = pathAndQuery.indexOf('?');
  if (q < 0) return { pathname: pathAndQuery || '/', search: '' };
  return {
    pathname: pathAndQuery.slice(0, q) || '/',
    search: pathAndQuery.slice(q + 1),
  };
}

export function hrefMatchesLocation(href: string, pathname: string, search = '') {
  const target = splitHref(href);
  if (target.pathname !== pathname) return false;
  if (!target.search) return true;
  const wanted = new URLSearchParams(target.search);
  const current = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  let matches = true;
  wanted.forEach((value, key) => {
    if (current.get(key) !== value) matches = false;
  });
  return matches;
}

export function navigationWaitState(elapsedMs: number) {
  return {
    announceSlow: elapsedMs >= NAV_SLOW_MS,
    offerRecovery: elapsedMs >= NAV_STUCK_MS,
  };
}
