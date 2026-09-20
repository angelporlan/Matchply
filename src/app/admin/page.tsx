import { getAdminSummaryCounts } from '@/lib/admin/users';
import { requireAdminContext } from '@/lib/request-context';
import { AdminErrorState } from '@/components/admin/AdminStates';
import { isUmamiAdminEnabled } from '@/lib/flags';

export const dynamic = 'force-dynamic';

export default async function AdminSummaryPage() {
  await requireAdminContext();
  let stats;
  let error: string | null = null;
  try {
    stats = await getAdminSummaryCounts();
  } catch (err: any) {
    error = err.message || 'No se han podido cargar las cuentas.';
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold font-display">Resumen</h2>
      {error || !stats ? (
        <AdminErrorState title="No se pudieron cargar las cuentas" description={error || 'Inténtalo de nuevo.'} />
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['Usuarios registrados', stats.totalUsers],
            ['Invitados (aparte)', stats.totalGuests],
            ['CVs', stats.totalCvs],
            ['Candidaturas', stats.totalOffers],
            ['Pro Stripe (active/trialing)', stats.stripePro],
            ['Pro por concesión', stats.grantedPro],
            ['Cuentas suspendidas', stats.suspended],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-[12px] border border-subtle bg-surface p-5">
              <dt className="text-sm text-text-muted">{label}</dt>
              <dd className="mt-2 text-3xl font-display font-semibold text-text">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="text-sm text-text-muted">
        El tráfico agregado se consulta en <a className="underline" href="/admin/traffic">Tráfico</a>.
        {isUmamiAdminEnabled() ? '' : ' Umami no está configurado; las cuentas de Postgres siguen siendo la fuente de verdad.'}
      </p>
    </div>
  );
}
