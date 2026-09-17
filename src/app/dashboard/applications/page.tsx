import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/db';
import { applicationViews, cvs, jobOffers, users } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import ApplicationsClient from '@/components/applications/ApplicationsClient';
import { isProSubscription } from '@/lib/subscription';
import { cvListColumns, applicationSummaryColumns } from '@/lib/job-offer-queries';
import { listCompanyLookups } from '@/lib/company-service';
import { SYSTEM_VIEWS, normalizeViewConfig } from '@/lib/application-views';

interface ApplicationsPageProps {
  searchParams?: { layout?: string; view?: string; company?: string };
}

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // 1. Obtener información actualizada del usuario de la base de datos
  const [dbUser] = await db
    .select({ subscriptionStatus: users.subscriptionStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  if (!isPremium) {
    redirect('/dashboard/subscription');
  }

  // 2. Cargar currículums, postulaciones y vistas guardadas
  const [userCvs, rawOffers, viewRows, companies] = await Promise.all([
    db
      .select(cvListColumns)
      .from(cvs)
      .where(eq(cvs.userId, userId))
      .orderBy(desc(cvs.createdAt)),
    db
      .select(applicationSummaryColumns)
      .from(jobOffers)
      .where(eq(jobOffers.userId, userId))
      .orderBy(desc(jobOffers.updatedAt)),
    db
      .select({
        id: applicationViews.id,
        name: applicationViews.name,
        isDefault: applicationViews.isDefault,
        config: applicationViews.config,
      })
      .from(applicationViews)
      .where(eq(applicationViews.userId, userId))
      .orderBy(desc(applicationViews.isDefault), asc(applicationViews.name)),
    listCompanyLookups(userId),
  ]);

  const offers = rawOffers.map((offer) => ({
    ...offer,
    status: offer.status.startsWith('archived:') ? 'archived' : offer.status,
  }));

  const savedViews = viewRows.map((view) => ({
    id: view.id,
    name: view.name,
    isDefault: view.isDefault,
    config: normalizeViewConfig(view.config),
  }));

  const cookieStore = cookies();
  const cookieView = cookieStore.get('applications_view')?.value;
  const cookieLayout = cookieStore.get('applications_layout')?.value;

  const defaultViewId = savedViews.find((view) => view.isDefault)?.id || SYSTEM_VIEWS[0].id;
  const requestedViewId = searchParams?.view || cookieView;
  const initialViewId = requestedViewId
    && (savedViews.some((view) => view.id === requestedViewId) || SYSTEM_VIEWS.some((view) => view.id === requestedViewId))
    ? requestedViewId
    : defaultViewId;

  const requestedLayout = searchParams?.layout || (cookieLayout === 'board' ? 'board' : 'table');
  const initialLayout = requestedLayout === 'board' ? 'board' : 'table';
  const isTableLayout = initialLayout === 'table';

  return (
    <div className={`relative overflow-x-clip min-h-screen ${isTableLayout ? 'md:h-[100dvh] md:overflow-hidden' : ''}`}>
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className={`max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 ${isTableLayout ? 'md:h-full md:flex md:flex-col md:min-h-0' : ''}`}>
        <ApplicationsClient
          offers={offers}
          userCvs={userCvs}
          companies={companies}
          savedViews={savedViews}
          initialLayout={initialLayout}
          initialViewId={initialViewId}
          initialCompanyId={searchParams?.company}
        />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
