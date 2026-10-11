import Link from 'next/link';
import { listAdminUsers } from '@/lib/admin/users';
import { requireAdminContext } from '@/lib/request-context';
import { AdminErrorState } from '@/components/admin/AdminStates';
import AdminDataTable from '@/components/admin/AdminDataTable';
import { userListQueryString } from '@/lib/admin/user-list-query';
import { ADMIN_USER_COLUMNS, adminOptionLabel } from '@/lib/admin/table-filters';
import { getServerTranslations } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({ searchParams }: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdminContext();
  const { language } = getServerTranslations();
  const en = language === 'en';
  const date = (value: Date | null) => value
    ? new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' }).format(value)
    : (en ? 'Unknown' : 'Desconocido');
  try {
    const result = await listAdminUsers(searchParams || {});
    return <AdminDataTable kind="users" columns={ADMIN_USER_COLUMNS} query={result.query} total={result.total}
      rows={result.rows.map(user => ({
        id: user.id,
        cells: {
          name: <Link className="font-semibold text-text hover:underline focus-visible:underline" title={user.id}
            href={`/admin/users/${user.id}${userListQueryString(result.query)}`}>
            {user.name || (en ? 'No name' : 'Sin nombre')}
          </Link>,
          email: <span className="text-text-muted">{user.email}</span>,
          createdAt: <span className="whitespace-nowrap">{date(user.createdAt)}</span>,
          lastLoginAt: <span className="whitespace-nowrap text-text-muted">{date(user.lastLoginAt)}</span>,
          lastSeenAt: <span className="whitespace-nowrap text-text-muted">{date(user.lastSeenAt)}</span>,
          role: adminOptionLabel('role', user.role, en),
          plan: <span className="inline-flex whitespace-nowrap rounded-[6px] bg-surface-muted px-2 py-1 font-medium">{adminOptionLabel('plan', user.planSource, en)}</span>,
          status: <span className={`inline-flex whitespace-nowrap rounded-[6px] px-2 py-1 font-medium ${user.accountStatus === 'suspended' ? 'bg-warning-surface text-warning-text' : 'bg-success-surface text-success-text'}`}>
            {adminOptionLabel('status', user.accountStatus, en)}
          </span>,
        },
      }))} />;
  } catch (error: unknown) {
    return <AdminErrorState title={en ? 'Could not load users' : 'No se pudo cargar usuarios'}
      description={error instanceof Error ? error.message : (en ? 'Try again.' : 'Inténtalo de nuevo.')} />;
  }
}
