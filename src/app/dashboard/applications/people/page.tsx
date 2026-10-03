import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDashboardViewer } from '@/lib/session';
import { loadCrmWorkspace } from '@/lib/crm-workspace';
import PeopleClient from '@/components/people/PeopleClient';
export const dynamic = 'force-dynamic';
export default async function PeoplePage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const viewer = await getDashboardViewer();
  if (!viewer) redirect('/login');
  if (viewer.isGuest) redirect('/register');
  const workspace = await loadCrmWorkspace('people', viewer.user.id, searchParams, cookies().get('people_view')?.value);
  return <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8"><PeopleClient {...workspace} links={{ companyId: searchParams.companyId, offerId: searchParams.offerId }} creating={searchParams.new === '1'} /></main>;
}
