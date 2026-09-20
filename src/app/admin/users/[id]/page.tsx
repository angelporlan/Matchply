import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminUserDetail } from '@/lib/admin/users';
import { getUserActivityLogs } from '@/lib/admin/audit-query';
import { requireAdminContext } from '@/lib/request-context';
import { formatDate } from '@/lib/utils';
import { isImpersonationEnabled } from '@/lib/flags';
import { hasProAccess } from '@/lib/subscription';
import UserAdminActions from '@/components/admin/UserAdminActions';

export const dynamic = 'force-dynamic';

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { admin } = await requireAdminContext();
  const page = Number(searchParams?.page) || 1;
  const detail = await getAdminUserDetail(params.id, page, 25);
  if (!detail) notFound();
  const activity = await getUserActivityLogs(params.id, page, 25);
  const user = detail.user;
  const canImpersonate = isImpersonationEnabled()
    && user.role !== 'admin'
    && !user.isGuest
    && user.accountStatus !== 'suspended'
    && user.id !== admin.id;

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm font-semibold underline">Volver al listado</Link>
      <div className="rounded-[12px] border border-subtle bg-surface p-6 space-y-2">
        <h2 className="text-xl font-semibold font-display">{user.name || 'Sin nombre'}</h2>
        <p className="text-sm text-text-muted">{user.email}</p>
        <dl className="grid sm:grid-cols-2 gap-3 text-sm pt-4">
          <div><dt className="text-text-muted">Alta</dt><dd>{formatDate(user.createdAt)}</dd></div>
          <div><dt className="text-text-muted">Último acceso</dt><dd>{user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Desconocido'}</dd></div>
          <div><dt className="text-text-muted">Última actividad</dt><dd>{user.lastSeenAt ? formatDate(user.lastSeenAt) : 'Desconocido'}</dd></div>
          <div><dt className="text-text-muted">Rol</dt><dd>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</dd></div>
          <div><dt className="text-text-muted">Estado Stripe</dt><dd>{user.subscriptionStatus}</dd></div>
          <div><dt className="text-text-muted">Concesión Pro</dt><dd>{user.proGrantedUntil ? formatDate(user.proGrantedUntil) : 'Ninguna'}</dd></div>
          <div><dt className="text-text-muted">Acceso Pro efectivo</dt><dd>{hasProAccess(user) ? 'Sí' : 'No'}</dd></div>
          <div><dt className="text-text-muted">Cuenta</dt><dd>{user.accountStatus === 'suspended' ? `Suspendida${user.suspensionReason ? `: ${user.suspensionReason}` : ''}` : 'Activa'}</dd></div>
          <div><dt className="text-text-muted">CVs</dt><dd>{detail.cvCount}</dd></div>
          <div><dt className="text-text-muted">Candidaturas</dt><dd>{detail.offerCount}</dd></div>
        </dl>
      </div>

      <UserAdminActions
        userId={user.id}
        role={user.role}
        accountStatus={user.accountStatus}
        canImpersonate={canImpersonate}
        hasGrant={Boolean(user.proGrantedUntil)}
      />

      <section className="space-y-3">
        <h3 className="font-display font-semibold">CVs (metadatos)</h3>
        {detail.cvs.length === 0 ? <p className="text-sm text-text-muted">Sin CVs.</p> : (
          <ul className="rounded-[12px] border border-subtle divide-y divide-subtle">
            {detail.cvs.map((cv) => (
              <li key={cv.id} className="px-4 py-3 text-sm">{cv.title} · {cv.isPrincipal ? 'Principal' : ''} {cv.isBase ? 'Base' : ''} · {formatDate(cv.updatedAt)}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-display font-semibold">Candidaturas (resumen)</h3>
        {detail.offers.length === 0 ? <p className="text-sm text-text-muted">Sin candidaturas.</p> : (
          <ul className="rounded-[12px] border border-subtle divide-y divide-subtle">
            {detail.offers.map((offer) => (
              <li key={offer.id} className="px-4 py-3 text-sm">{offer.title} · {offer.company} · {offer.status}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-display font-semibold">Actividad reciente</h3>
        {activity.rows.length === 0 ? <p className="text-sm text-text-muted">Sin eventos.</p> : (
          <ul className="rounded-[12px] border border-subtle divide-y divide-subtle">
            {activity.rows.map((row) => (
              <li key={row.id} className="px-4 py-3 text-sm">
                <span className="font-medium">{row.action}</span>
                <span className="text-text-muted"> · {formatDate(row.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
