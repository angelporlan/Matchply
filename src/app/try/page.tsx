import { redirect } from 'next/navigation';
import { getDashboardViewer } from '@/lib/session';

export default async function TryPage() {
  const viewer = await getDashboardViewer();
  if (viewer) redirect('/dashboard');
  redirect('/api/guest?redirect=/dashboard');
}

export const dynamic = 'force-dynamic';
