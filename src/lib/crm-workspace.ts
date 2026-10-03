import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { applicationViews } from '@/db/schema';
import { listCompanyLookups } from './company-service';
import { listCrmPage } from './crm-list-query';
import { normalizeCrmConfig, systemCrmViews, type ListEntity, type SavedCrmView } from './crm-views';
import { UUID_PATTERN } from './people/types';

export async function loadCrmWorkspace(entity: ListEntity, userId: string, params: Record<string, string | undefined>, cookieView?: string) {
  const [rows, lookups] = await Promise.all([
    db.select({ id: applicationViews.id, name: applicationViews.name, isDefault: applicationViews.isDefault, config: applicationViews.config }).from(applicationViews).where(and(eq(applicationViews.userId, userId), eq(applicationViews.entity, entity))).orderBy(desc(applicationViews.isDefault), asc(applicationViews.name)),
    entity === 'people' ? listCompanyLookups(userId) : Promise.resolve([]),
  ]);
  const savedViews: SavedCrmView[] = rows.map(row => ({ ...row, config: normalizeCrmConfig(entity, row.config) })), systems = systemCrmViews(entity);
  const valid = (id?: string) => !!id && (savedViews.some(v => v.id === id) || systems.some(v => v.id === id));
  const initialViewId = valid(params.view) ? params.view! : valid(cookieView) ? cookieView! : savedViews.find(v => v.isDefault)?.id || 'all';
  const initialConfig = normalizeCrmConfig(entity, savedViews.find(v => v.id === initialViewId)?.config || systems.find(v => v.id === initialViewId)?.config);
  if (entity === 'people') {
    if (params.q !== undefined) initialConfig.filters.search = params.q;
    if (params.status) initialConfig.filters.columnFilters!.push({ column: 'status', operator: 'in', value: '', values: [params.status] });
    if (params.companyId && UUID_PATTERN.test(params.companyId)) initialConfig.filters.columnFilters = [...initialConfig.filters.columnFilters!.filter(f => f.column !== 'companyNames'), { column: 'companyNames', operator: 'in', value: '', values: [params.companyId] }];
    if (params.offerId && UUID_PATTERN.test(params.offerId)) initialConfig.filters.offerId = params.offerId;
    if (params.due !== undefined) initialConfig.filters.due = params.due === '1';
  }
  const config = normalizeCrmConfig(entity, initialConfig);
  return { savedViews, initialViewId, initialConfig: config, initialData: await listCrmPage(userId, entity, config, Number(params.page) || 1), lookups };
}
