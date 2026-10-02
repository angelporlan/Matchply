import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { applicationViews, cvs } from '@/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import ApplicationsClient from '@/components/applications/ApplicationsClient';
import { hasProAccess } from '@/lib/subscription';
import { cvListColumns } from '@/lib/job-offer-queries';
import { listCompanyLookups } from '@/lib/company-service';
import { SYSTEM_VIEWS, normalizeViewConfig } from '@/lib/application-views';
import { getDashboardViewer } from '@/lib/session';
import { loadApplicationsWorkspace } from '@/lib/application-list-query';
import { timed } from '@/lib/logger';

interface ApplicationsPageProps {
  searchParams?: { layout?: string; view?: string; company?: string };
}

export default async function ApplicationsPage({ searchParams }: ApplicationsPageProps) {
  const viewer = await getDashboardViewer();
  if (!viewer) {
    redirect('/login');
  }
  const dbUser = viewer.user;

  const userId = dbUser.id;
  const isPremium = hasProAccess(dbUser);

  if (searchParams?.layout) {
    const params = new URLSearchParams();
    if (searchParams.view) params.set('view', searchParams.view);
    if (searchParams.company) params.set('company', searchParams.company);
    const query = params.toString();
    redirect(query ? `/dashboard/applications?${query}` : '/dashboard/applications');
  }

  const cookieStore = cookies();
  const cookieView = cookieStore.get('applications_view')?.value;

  const [userCvs, viewRows, companies] = await timed('nav_queries', { route: '/dashboard/applications', phase: 'aux' }, () =>
    Promise.all([
      db
        .select(cvListColumns)
        .from(cvs)
        .where(eq(cvs.userId, userId))
        .orderBy(desc(cvs.createdAt)),
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
    ]),
  );

  const savedViews = viewRows.map((view) => ({
    id: view.id,
    name: view.name,
    isDefault: view.isDefault,
    config: normalizeViewConfig(view.config),
  }));

  const defaultViewId = savedViews.find((view) => view.isDefault)?.id || SYSTEM_VIEWS[0].id;
  const requestedViewId = searchParams?.view || cookieView;
  const initialViewId = requestedViewId
    && (savedViews.some((view) => view.id === requestedViewId) || SYSTEM_VIEWS.some((view) => view.id === requestedViewId))
    ? requestedViewId
    : defaultViewId;

  const viewConfig = savedViews.find((view) => view.id === initialViewId)?.config
    || SYSTEM_VIEWS.find((view) => view.id === initialViewId)?.config
    || SYSTEM_VIEWS[0].config;

  const filters = {
    ...viewConfig.filters,
    columnFilters: initialCompanyIdFilters(viewConfig.filters.columnFilters, searchParams?.company),
  };

  const workspace = await timed('nav_queries', { route: '/dashboard/applications', phase: 'list' }, () =>
    loadApplicationsWorkspace({
      userId,
      filters,
      sort: viewConfig.sort,
      page: 1,
      pageSize: viewConfig.pageSize,
    }),
  );

  return (
    <div className="relative overflow-x-clip min-h-screen">
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-ai/3 dark:bg-ai/5 blur-[120px] pointer-events-none" />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        <ApplicationsClient
          offers={workspace.items}
          filteredTotal={workspace.total}
          userCvs={userCvs}
          companies={companies}
          savedViews={savedViews}
          initialViewId={initialViewId}
          initialCompanyId={searchParams?.company}
        />
      </main>
    </div>
  );
}

function initialCompanyIdFilters(
  columnFilters: ReturnType<typeof normalizeViewConfig>['filters']['columnFilters'],
  companyId?: string,
) {
  const filters = columnFilters ?? [];
  if (!companyId) return filters;
  return [
    ...filters.filter((filter) => filter.column !== 'company'),
    { column: 'company' as const, operator: 'in' as const, value: '', values: [companyId] },
  ];
}

export const dynamic = 'force-dynamic';
