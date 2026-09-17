import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import { listCompaniesForUser } from '@/lib/company-service';
import CompaniesClient from '@/components/companies/CompaniesClient';

export default async function CompaniesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;
  const [dbUser] = await db
    .select({ subscriptionStatus: users.subscriptionStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!isProSubscription(dbUser?.subscriptionStatus || 'none')) {
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
