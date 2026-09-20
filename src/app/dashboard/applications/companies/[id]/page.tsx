import { redirect } from 'next/navigation';
import { db } from '@/db';
import { jobOffers } from '@/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { hasProAccess } from '@/lib/subscription';
import { getSessionUser } from '@/lib/session';
import {
  CompanyNotFoundError,
  getOwnedCompany,
  listCompanyNotes,
} from '@/lib/company-service';
import { applicationSummaryColumns } from '@/lib/job-offer-queries';
import CompanyDetailClient from '@/components/companies/CompanyDetailClient';

interface CompanyPageProps {
  params: { id: string };
}

export default async function CompanyDetailPage({ params }: CompanyPageProps) {
  const dbUser = await getSessionUser();
  if (!dbUser) {
    redirect('/login');
  }

  const userId = dbUser.id;
  if (!hasProAccess(dbUser)) {
    redirect('/dashboard/subscription');
  }

  try {
    const [company, notes, offers, statusRows] = await Promise.all([
      getOwnedCompany(userId, params.id),
      listCompanyNotes(userId, params.id),
      db
        .select(applicationSummaryColumns)
        .from(jobOffers)
        .where(and(eq(jobOffers.userId, userId), eq(jobOffers.companyId, params.id)))
        .orderBy(desc(jobOffers.updatedAt)),
      db
        .select({
          status: jobOffers.status,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(jobOffers)
        .where(and(eq(jobOffers.userId, userId), eq(jobOffers.companyId, params.id)))
        .groupBy(jobOffers.status),
    ]);

    const offersNormalized = offers.map((offer) => ({
      ...offer,
      status: offer.status.startsWith('archived:') ? 'archived' : offer.status,
    }));

    const statusCounts = statusRows.reduce<Record<string, number>>((acc, row) => {
      const status = row.status.startsWith('archived:') ? 'archived' : row.status;
      acc[status] = (acc[status] || 0) + Number(row.count || 0);
      return acc;
    }, {});

    return (
      <div className="relative overflow-x-hidden min-h-screen">
        <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

        <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <CompanyDetailClient
            company={company}
            notes={notes}
            offers={offersNormalized}
            statusCounts={statusCounts}
          />
        </main>
      </div>
    );
  } catch (error) {
    if (error instanceof CompanyNotFoundError) {
      redirect('/dashboard/applications/companies');
    }
    throw error;
  }
}

export const dynamic = 'force-dynamic';
