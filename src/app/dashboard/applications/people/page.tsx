import { redirect } from 'next/navigation';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { companies, personCompanies, userCompanies } from '@/db/schema';
import { getDashboardViewer } from '@/lib/session';
import { listPeople } from '@/lib/people/service';
import { PeopleError } from '@/lib/people/types';
import PeopleClient from '@/components/people/PeopleClient';
export const dynamic = 'force-dynamic';
export default async function PeoplePage({ searchParams = {} }: { searchParams?: { q?: string; companyId?: string; offerId?: string; status?: string; due?: string; page?: string; new?: string } }) {
  const viewer = await getDashboardViewer();
  if (!viewer) redirect('/login');
  if (viewer.isGuest) redirect('/register');
  const userId = viewer.user.id;
  try {
    const [data, companyOptions] = await Promise.all([
      listPeople(userId, { query: searchParams.q, companyId: searchParams.companyId, offerId: searchParams.offerId, status: searchParams.status, due: searchParams.due === '1', page: Number(searchParams.page) || 1 }),
      db.select({ id: companies.id, name: companies.name }).from(userCompanies).innerJoin(companies, eq(companies.id, userCompanies.companyId)).where(and(eq(userCompanies.userId, userId), inArray(companies.id, db.select({ id: personCompanies.companyId }).from(personCompanies).where(eq(personCompanies.userId, userId))))).orderBy(asc(companies.name)),
    ]);
    // Include the selected company even if it has no contacts yet (creation from a company).
    if (searchParams.companyId && !companyOptions.some(c => c.id === searchParams.companyId)) {
      const [company] = await db.select({ id: companies.id, name: companies.name }).from(userCompanies).innerJoin(companies, eq(companies.id, userCompanies.companyId)).where(and(eq(userCompanies.userId, userId), eq(companies.id, searchParams.companyId))).limit(1);
      if (company) companyOptions.push(company);
    }
    return <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8"><PeopleClient data={data} filters={searchParams} companies={companyOptions} /></main>;
  } catch (error) { if (error instanceof PeopleError) redirect('/dashboard/applications/people'); throw error; }
}
