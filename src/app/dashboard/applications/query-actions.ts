'use server';

import { timed } from '@/lib/logger';
import {
  loadApplicationsWorkspace,
  listApplicationIds,
  listSelectedApplications,
  type ApplicationWorkspace,
} from '@/lib/application-list-query';
import type { ApplicationSortState, ApplicationViewFilters } from '@/lib/application-views';
import { requireProductContext } from '@/lib/request-context';
import { crmIds } from '@/lib/crm-service';
import { getUserPlan } from '@/lib/plan-store';
import type { ApplicationSummary } from '@/lib/job-offer-queries';

export type ApplicationsQueryInput = {
  filters: ApplicationViewFilters;
  sort: ApplicationSortState;
  page?: number;
  pageSize?: number;
};

export async function queryApplicationsAction(
  input: ApplicationsQueryInput,
): Promise<{ success: true; data: ApplicationWorkspace } | { error: string }> {
  try {
    const ctx = await requireProductContext({ allowGuest: true, feature: 'applications' });
    const data = await timed('nav_queries', { route: '/dashboard/applications' }, () =>
      loadApplicationsWorkspace({
        userId: ctx.effectiveUser!.id,
        filters: input.filters,
        sort: input.sort,
        page: input.page,
        pageSize: input.pageSize,
      }),
    );
    return { success: true, data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'FAILED_TO_QUERY_APPLICATIONS' };
  }
}

export async function queryApplicationIdsAction(
  input: Pick<ApplicationsQueryInput, 'filters' | 'sort'>,
): Promise<{ success: true; ids: string[]; truncated: boolean } | { error: string }> {
  try {
    const ctx = await requireProductContext({ allowGuest: true, feature: 'applications' });
    const ids = await listApplicationIds({
      userId: ctx.effectiveUser!.id,
      filters: input.filters,
      sort: input.sort,
    });
    return { success: true, ids, truncated: ids.length >= 10_000 };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'FAILED_TO_QUERY_APPLICATION_IDS' };
  }
}

export async function querySelectedApplicationsAction(
  input: string[],
): Promise<{ offers: ApplicationSummary[] } | { error: string; code?: string; limit?: number }> {
  try {
    const ctx = await requireProductContext({ allowGuest: true, feature: 'applications' });
    const ids = crmIds(input);
    const { plan, limits } = await getUserPlan(ctx.effectiveUser!.id);
    if (ids.length > 1 && plan !== 'pro') {
      return { error: 'El matching en lote requiere el plan Pro.', code: 'PRO_REQUIRED' };
    }
    if (ids.length > Math.max(1, limits.matchBatchSize)) {
      return { error: `Selecciona como máximo ${Math.max(1, limits.matchBatchSize)} ofertas por lote.`, code: 'MATCH_BATCH_TOO_LARGE', limit: Math.max(1, limits.matchBatchSize) };
    }
    return { offers: await listSelectedApplications(ctx.effectiveUser!.id, ids) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudieron cargar las ofertas seleccionadas.' };
  }
}
