import Link from 'next/link';
import { listAdminUsers } from '@/lib/admin/users';
import { requireAdminContext } from '@/lib/request-context';
import { AdminEmptyState, AdminErrorState, AdminPagination } from '@/components/admin/AdminStates';
import { formatDate } from '@/lib/utils';
import { userListQueryString } from '@/lib/admin/user-list-query';
import { getEffectivePlanSource } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function planLabel(source: ReturnType<typeof getEffectivePlanSource>) {
  if (source === 'trialing') return 'Prueba Stripe';
  if (source === 'stripe') return 'Pro Stripe';
  if (source === 'granted') return 'Pro concesión';
  return 'Gratis';
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdminContext();
  let result: Awaited<ReturnType<typeof listAdminUsers>> | null = null;
  let error: string | null = null;
  try {
    result = await listAdminUsers(searchParams || {});
  } catch (err: any) {
    error = err.message || 'No se pudo cargar el listado.';
  }

  const q = result?.query;
  const hrefFor = (page: number) => `/admin/users${userListQueryString({ ...(q || {}), page })}`;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold font-display">Usuarios</h2>
      <form method="get" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 rounded-[12px] border border-subtle bg-surface p-4">
        <label className="text-sm font-medium">Buscar
          <input name="q" defaultValue={q?.q} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" placeholder="Nombre, correo o id" />
        </label>
        <label className="text-sm font-medium">Alta
          <select name="created" defaultValue={q?.created || ''} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="">Cualquiera</option>
            <option value="today">Hoy</option>
            <option value="7d">Últimos 7 días</option>
            <option value="30d">Últimos 30 días</option>
            <option value="custom">Rango</option>
          </select>
        </label>
        <label className="text-sm font-medium">Desde
          <input type="date" name="from" defaultValue={q?.from} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
        </label>
        <label className="text-sm font-medium">Hasta
          <input type="date" name="to" defaultValue={q?.to} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3" />
        </label>
        <label className="text-sm font-medium">Rol
          <select name="role" defaultValue={q?.role || 'all'} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="all">Todos</option>
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label className="text-sm font-medium">Plan
          <select name="plan" defaultValue={q?.plan || 'all'} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="all">Todos</option>
            <option value="pro">Pro (cualquier origen)</option>
            <option value="stripe">Pago Stripe</option>
            <option value="trialing">Prueba Stripe</option>
            <option value="granted">Concesión</option>
            <option value="free">Gratis</option>
          </select>
        </label>
        <label className="text-sm font-medium">Estado
          <select name="status" defaultValue={q?.status || 'all'} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="all">Todos</option>
            <option value="active">Activo</option>
            <option value="suspended">Suspendido</option>
          </select>
        </label>
        <label className="text-sm font-medium">Actividad
          <select name="activity" defaultValue={q?.activity || 'all'} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="all">Cualquiera</option>
            <option value="7d">Vistos en 7 días</option>
            <option value="30d">Vistos en 30 días</option>
            <option value="none">Sin actividad registrada</option>
          </select>
        </label>
        <label className="text-sm font-medium">Orden
          <select name="sort" defaultValue={q?.sort || 'createdAt'} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="createdAt">Alta</option>
            <option value="lastSeenAt">Última actividad</option>
            <option value="lastLoginAt">Último acceso</option>
            <option value="email">Correo</option>
            <option value="name">Nombre</option>
          </select>
        </label>
        <label className="text-sm font-medium">Dirección
          <select name="dir" defaultValue={q?.dir || 'desc'} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="desc">Descendente</option>
            <option value="asc">Ascendente</option>
          </select>
        </label>
        <label className="text-sm font-medium">Filas
          <select name="pageSize" defaultValue={String(q?.pageSize || 25)} className="mt-1 w-full min-h-[44px] rounded-[8px] border border-control bg-canvas px-3">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn-raised min-h-[44px] w-full">Filtrar</button>
        </div>
      </form>

      {error ? (
        <AdminErrorState title="No se pudo cargar usuarios" description={error} />
      ) : !result || result.rows.length === 0 ? (
        <AdminEmptyState title="Sin resultados" description="Prueba otro filtro o búsqueda. Los invitados no aparecen en este listado." />
      ) : (
        <>
          <p className="text-sm text-text-muted">{result.total} cuentas</p>
          <div className="hidden md:block overflow-x-auto rounded-[12px] border border-subtle">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Correo</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                  <th className="px-4 py-3 font-semibold">Último acceso</th>
                  <th className="px-4 py-3 font-semibold">Actividad</th>
                  <th className="px-4 py-3 font-semibold">Rol</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((user) => (
                  <tr key={user.id} className="border-t border-subtle">
                    <td className="px-4 py-3 min-h-[44px]">
                      <Link className="font-semibold underline" href={`/admin/users/${user.id}${userListQueryString(result.query)}`}>{user.name || 'Sin nombre'}</Link>
                    </td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3">{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Desconocido'}</td>
                    <td className="px-4 py-3">{user.lastSeenAt ? formatDate(user.lastSeenAt) : 'Desconocido'}</td>
                    <td className="px-4 py-3">{user.role === 'admin' ? 'Administrador' : 'Usuario'}</td>
                    <td className="px-4 py-3">{planLabel(user.planSource)}</td>
                    <td className="px-4 py-3">{user.accountStatus === 'suspended' ? 'Suspendido' : 'Activo'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-3">
            {result.rows.map((user) => (
              <Link key={user.id} href={`/admin/users/${user.id}${userListQueryString(result.query)}`} className="block rounded-[12px] border border-subtle bg-surface p-4">
                <p className="font-semibold">{user.name || 'Sin nombre'}</p>
                <p className="text-sm text-text-muted">{user.email}</p>
                <p className="text-sm mt-2">{planLabel(user.planSource)} · {user.accountStatus === 'suspended' ? 'Suspendido' : 'Activo'}</p>
              </Link>
            ))}
          </div>
          <AdminPagination page={result.query.page} pageCount={result.pageCount} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
