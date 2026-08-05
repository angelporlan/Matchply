const VALID_PLANS = new Set(['free', 'pro']);
const VALID_TEMPLATES = new Set(['harvard', 'modern', 'minimal', 'creative', 'swiss']);

function readParam(value: string | null, maxLength = 120) {
  if (!value || value.length > maxLength || /[\\\u0000-\u001f]/.test(value)) return null;
  return value;
}

export function safeInternalPath(value: string | null | undefined, fallback = '/dashboard') {
  const candidate = typeof value === 'string' ? value : '';
  if (!candidate || candidate.length > 512 || !candidate.startsWith('/') || candidate.startsWith('//') || /[\\\u0000-\u001f]/.test(candidate)) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, 'https://matchply.internal');
    if (parsed.origin !== 'https://matchply.internal') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getAuthIntent(searchParams: URLSearchParams | { get(name: string): string | null }) {
  const rawNext = safeInternalPath(searchParams.get('next') || searchParams.get('callbackUrl'), '/dashboard');
  let next = rawNext;
  let nestedParams: URLSearchParams | null = null;

  // NextAuth sends the original claim URL as callbackUrl. Unwrap it once so
  // login/register never create /auth/claim?next=/auth/claim/... chains.
  if (rawNext.startsWith('/auth/claim')) {
    const claimUrl = new URL(rawNext, 'https://matchply.internal');
    nestedParams = claimUrl.searchParams;
    next = safeInternalPath(nestedParams.get('next'), '/dashboard');
  }

  const plan = readParam(nestedParams?.get('plan') || searchParams.get('plan'), 16);
  const template = readParam(nestedParams?.get('template') || searchParams.get('template'), 32);
  const source = readParam(nestedParams?.get('source') || searchParams.get('source'), 64);

  return {
    next,
    plan: plan && VALID_PLANS.has(plan) ? plan : null,
    template: template && VALID_TEMPLATES.has(template) ? template : null,
    source: source && /^[a-zA-Z0-9_-]+$/.test(source) ? source : null,
  };
}

export function buildClaimPath(intent: ReturnType<typeof getAuthIntent>) {
  const params = new URLSearchParams({ next: safeInternalPath(intent.next) });
  if (intent.plan) params.set('plan', intent.plan);
  if (intent.template) params.set('template', intent.template);
  if (intent.source) params.set('source', intent.source);
  return `/auth/claim?${params.toString()}`;
}

export function buildAuthPath(intent: ReturnType<typeof getAuthIntent>, pathname: '/login' | '/register') {
  const params = new URLSearchParams();
  params.set('next', safeInternalPath(intent.next));
  if (intent.plan) params.set('plan', intent.plan);
  if (intent.template) params.set('template', intent.template);
  if (intent.source) params.set('source', intent.source);
  return `${pathname}?${params.toString()}`;
}
