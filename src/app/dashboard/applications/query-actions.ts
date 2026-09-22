'use server';

import { timed } from '@/lib/logger';
import {
  loadApplicationsWorkspace,
  listApplicationIds,
  listApplicationsBoard,
  type ApplicationWorkspace,
} from '@/lib/application-list-query';
import type { ApplicationSortState, ApplicationStatus, ApplicationViewFilters } from '@/lib/application-views';
import { BOARD_COLUMN_PAGE_SIZE } from '@/lib/application-filter-bounds';
import { requireProductContext } from '@/lib/request-context';

export type ApplicationsQueryInput = {
  layout: 'table' | 'board';
  filters: ApplicationViewFilters;
  sort: ApplicationSortState;
  page?: number;
  pageSize?: number;
};

export async function queryApplicationsAction(
  input: ApplicationsQueryInput,
): Promise<{ success: true; data: ApplicationWorkspace } | { error: string }> {
  try {
    const ctx = await requireProductContext({ feature: 'applications' });
    const data = await timed('nav_queries', { route: '/dashboard/applications', layout: input.layout }, () =>
      loadApplicationsWorkspace({
        userId: ctx.effectiveUser!.id,
        layout: input.layout,
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
    const ctx = await requireProductContext({ feature: 'applications' });
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

export async function queryApplicationsBoardMoreAction(input: {
  filters: ApplicationViewFilters;
  sort: ApplicationSortState;
  status: ApplicationStatus;
  offset: number;
}): Promise<{ success: true; items: ApplicationWorkspace['items'] } | { error: string }> {
  try {
    const ctx = await requireProductContext({ feature: 'applications' });
    const items = await listApplicationsBoard({
      userId: ctx.effectiveUser!.id,
      filters: { ...input.filters, excludedStatuses: [] },
      sort: input.sort,
      limitPerStatus: BOARD_COLUMN_PAGE_SIZE,
      offsets: { [input.status]: input.offset },
      statuses: [input.status],
    });
    return { success: true, items };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'FAILED_TO_QUERY_BOARD' };
  }
}
