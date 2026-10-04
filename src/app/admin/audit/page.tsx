import { listAdminAuditLogs } from '@/lib/admin/audit-query';
import { requireAdminContext } from '@/lib/request-context';
import { AdminErrorState } from '@/components/admin/AdminStates';
import AdminDataTable from '@/components/admin/AdminDataTable';
import { ADMIN_AUDIT_COLUMNS, adminOptionLabel } from '@/lib/admin/table-filters';
import { getServerTranslations } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

function AuditUser({ id, name, email }: {
  id: string | null; name: string | null; email: string | null;
}) {
  if (!id) return <span>—</span>;
  const displayName = name?.trim();
  return <div title={id} className="min-w-36 break-words">
    <span className={displayName || email ? 'font-medium' : 'font-mono'}>{displayName || email || id}</span>
    {displayName && email && <div className="mt-0.5 text-text-muted">{email}</div>}
  </div>;
}

export default async function AdminAuditPage({ searchParams }: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdminContext();
  const { language } = getServerTranslations();
  const en = language === 'en';
  try {
    const result = await listAdminAuditLogs(searchParams || {});
    return <AdminDataTable kind="audit" columns={ADMIN_AUDIT_COLUMNS} query={result.query} total={result.total}
      rows={result.rows.map(row => ({
        id: row.id,
        cells: {
          createdAt: <span className="whitespace-nowrap">{new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid' }).format(row.createdAt)}</span>,
          action: <span className="font-mono">{row.action}</span>,
          userEmail: <span className="text-text-muted">{row.userEmail || '—'}</span>,
          actorUserId: <AuditUser id={row.actorUserId} name={row.actorName} email={row.actorEmail} />,
          affectedUserId: <AuditUser id={row.affectedUserId} name={row.affectedName} email={row.affectedEmail} />,
          category: <span className="inline-flex whitespace-nowrap rounded-[6px] bg-surface-muted px-2 py-1 font-medium">{adminOptionLabel('category', row.category, en)}</span>,
        },
      }))} />;
  } catch (error: unknown) {
    return <AdminErrorState title={en ? 'Could not load audit' : 'No se pudo cargar la auditoría'}
      description={error instanceof Error ? error.message : (en ? 'Try again.' : 'Inténtalo de nuevo.')} />;
  }
}
