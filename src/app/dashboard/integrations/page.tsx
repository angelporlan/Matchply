import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/request-context';
import { getDashboardViewer } from '@/lib/session';

export default async function IntegrationsRedirectPage() {
  const viewer = await getDashboardViewer();
  if (viewer?.isGuest) redirect('/dashboard');

  const ctx = await getRequestContext();
  if (ctx.impersonation) redirect('/dashboard/profile?tab=profile');
  redirect('/dashboard/profile?tab=integrations');
}
