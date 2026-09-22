export function replaceUrlQuery(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  const url = query ? `${pathname}?${query}` : pathname;
  if (typeof window === 'undefined') return url;
  window.history.replaceState(window.history.state, '', url);
  return url;
}
