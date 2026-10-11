import { redirect } from 'next/navigation';
import { getDashboardViewer } from '@/lib/session';
import { getPlanConfig } from '@/lib/plan-store';
import { hasProAccess } from '@/lib/subscription';
import SubscriptionContent from '@/components/subscription/SubscriptionContent';

export const dynamic = 'force-dynamic';

export default async function SubscriptionPage() {
  const viewer = await getDashboardViewer();
  if (!viewer) redirect('/login');
  if (viewer.impersonation) redirect('/dashboard');
  return <SubscriptionContent config={await getPlanConfig()} isPremium={hasProAccess(viewer.user)} />;
}
