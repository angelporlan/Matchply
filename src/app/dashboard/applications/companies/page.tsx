import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDashboardViewer } from '@/lib/session';
import { loadCrmWorkspace } from '@/lib/crm-workspace';
import CompaniesClient from '@/components/companies/CompaniesClient';
export const dynamic = 'force-dynamic';
export default async function CompaniesPage({ searchParams = {} }: { searchParams?: Record<string, string | undefined> }) {
  const viewer = await getDashboardViewer();
  if (!viewer) redirect('/login');
  const workspace = await loadCrmWorkspace('companies', viewer.user.id, searchParams, cookies().get('companies_view')?.value);
  return <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8"><CompaniesClient {...workspace} /></main>;
}
