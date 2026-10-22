import { createHash } from 'node:crypto';
import { expect, type BrowserContext } from '@playwright/test';
export const profiles = ['small', 'medium', 'large'] as const;
export const fixtureId = (value: string) => { const h = createHash('sha256').update(`matchply-perf:${value}`).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
export async function login(context: BrowserContext, profile = 'medium') {
  const csrf = await (await context.request.get('/api/auth/csrf')).json();
  await context.request.post('/api/auth/callback/credentials', { form: {
    csrfToken: csrf.csrfToken, email: `perf-${profile}@example.test`, password: 'Performance-test-only-123', callbackUrl: '/dashboard',
  } });
  const session = await (await context.request.get('/api/auth/session')).json();
  expect(session.user?.id).toBe(fixtureId(profile));
}
export const routes = (profile: string) => [
  '/dashboard', '/dashboard/applications', '/dashboard/applications?view=archived',
  '/dashboard/applications/companies', '/dashboard/applications/people',
  '/dashboard/profile?tab=account', `/editor/${fixtureId(`${profile}:cv:0`)}`,
];
