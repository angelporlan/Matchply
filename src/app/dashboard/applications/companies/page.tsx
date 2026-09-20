import { redirect } from 'next/navigation';
import { hasProAccess } from '@/lib/subscription';
import { listCompaniesForUser } from '@/lib/company-service';
import { getSessionUser } from '@/lib/session';
import CompaniesClient from '@/components/companies/CompaniesClient';

export default async function CompaniesPage() {
  const dbUser = await getSessionUser();
  if (!dbUser) {
    redirect('/login');
  }

  const userId = dbUser.id;
  if (!hasProAccess(dbUser)) {
    redirect('/dashboard/subscription');
  }

  const companies = await listCompaniesForUser(userId);

  return (
    <div className="relative overflow-x-clip min-h-screen md:h-[100dvh] md:overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 md:h-full md:flex md:flex-col md:min-h-0">
        <CompaniesClient companies={companies} />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
