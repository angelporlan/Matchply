import { listAdminAuditLogs, listAuditActions } from '@/lib/admin/audit-query';
import { requireAdminContext } from '@/lib/request-context';
import { AdminEmptyState, AdminErrorState, AdminPagination } from '@/components/admin/AdminStates';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdminContext();
  try {
    const [result, actions] = await Promise.all([
      listAdminAuditLogs(searchParams || {}),
      listAuditActions(),
    ]);
    const params = new URLSearchParams();
    Object.entries(searchParams || {}).forEach(([key, value]) => {
      const text = Array.isArray(value) ? value[0] : value;
      if (text) params.set(key, text);
    });
    const hrefFor = (page: number) => {
      params.set('page', String(page));
      return `/admin/audit?${params.toString()}`;
    };

    return (
      <div className="space-y-5">
        <h2 className="text-xl font-semibold font-display">Auditoría</h2>
        <form method="get" className="grid md:grid-cols-3 gap-3 rounded-[12px] border border-subtle bg-surface p-4">
          <label className="text-sm font-medium">Buscar
            <input name="q" defaultValue={result.query.q} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
          </label>
          <label className="text-sm font-medium">Acción
            <select name="action" defaultValue={result.query.action} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
              <option value="">Todas</option>
              {actions.map((action) => <option key={action} value={action}>{action}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Categoría
            <select name="category" defaultValue={result.query.category} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
              <option value="all">Todas</option>
              <option value="admin">Administrativa</option>
              <option value="ordinary">Ordinaria</option>
            </select>
          </label>
          <label className="text-sm font-medium">Administrador (id)
            <input name="actorId" defaultValue={result.query.actorId} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3 font-mono text-sm" />
          </label>
          <label className="text-sm font-medium">Usuario afectado (id)
            <input name="affectedId" defaultValue={result.query.affectedId} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3 font-mono text-sm" />
          </label>
          <label className="text-sm font-medium">Periodo
            <select name="created" defaultValue={result.query.created} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
              <option value="">Cualquiera</option>
              <option value="today">Hoy</option>
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
              <option value="custom">Rango</option>
            </select>
          </label>
          <label className="text-sm font-medium">Desde
            <input type="date" name="from" defaultValue={result.query.from} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
          </label>
          <label className="text-sm font-medium">Hasta
            <input type="date" name="to" defaultValue={result.query.to} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
          </label>
          <div className="flex items-end">
            <button type="submit" className="btn-raised min-h-[44px] w-full">Filtrar</button>
          </div>
        </form>

        {result.rows.length === 0 ? (
          <AdminEmptyState title="Sin eventos" description="No hay registros para estos filtros." />
        ) : (
          <>
            <div className="overflow-x-auto rounded-[12px] border border-subtle">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-left">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Acción</th>
                    <th className="px-4 py-3">Correo</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Afectado</th>
                    <th className="px-4 py-3">Categoría</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id} className="border-t border-subtle">
                      <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.action}</td>
                      <td className="px-4 py-3">{row.userEmail || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.actorUserId || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.affectedUserId || '—'}</td>
                      <td className="px-4 py-3">{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <AdminPagination page={result.query.page} pageCount={result.pageCount} hrefFor={hrefFor} />
          </>
        )}
      </div>
    );
  } catch (error: any) {
    return <AdminErrorState title="No se pudo cargar la auditoría" description={error.message || 'Inténtalo de nuevo.'} />;
  }
}
