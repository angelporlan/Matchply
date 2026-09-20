import { redirect } from 'next/navigation';
import { getRequestContext } from '@/lib/request-context';

export default async function IntegrationsRedirectPage() {
  const ctx = await getRequestContext();
  if (ctx.impersonation) redirect('/dashboard/profile?tab=profile');
  redirect('/dashboard/profile?tab=integrations');
}
