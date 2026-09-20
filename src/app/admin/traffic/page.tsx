import { fetchUmamiSummary, type UmamiPeriod } from '@/lib/admin/umami-api';
import { requireAdminContext } from '@/lib/request-context';
import { AdminErrorState } from '@/components/admin/AdminStates';
import { isUmamiCollectionEnabled } from '@/lib/flags';

export const dynamic = 'force-dynamic';

function delta(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function AdminTrafficPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdminContext();
  const period = (['24h', '7d', '30d', '12m'].includes(String(searchParams?.period))
    ? searchParams?.period
    : '7d') as UmamiPeriod;
  const result = await fetchUmamiSummary(period);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold font-display">Tráfico</h2>
      <p className="text-sm text-text-muted">
        Medición agregada. No hay recorridos individuales ni datos personales.
        Recogida {isUmamiCollectionEnabled() ? 'activa en producción' : 'desactivada hasta cumplir configuración y evaluación AEPD'}.
      </p>
      <form method="get" className="flex flex-wrap gap-2">
        {(['24h', '7d', '30d', '12m'] as const).map((value) => (
          <button
            key={value}
            name="period"
            value={value}
            className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold ${period === value ? 'border-control bg-surface-muted' : 'border-control'}`}
          >
            {value}
          </button>
        ))}
      </form>
      {!result.ok ? (
        <AdminErrorState title="Tráfico no disponible" description={result.error} />
      ) : (
        <>
          <dl className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-[12px] border border-subtle bg-surface p-5">
              <dt className="text-sm text-text-muted">Visitantes estimados</dt>
              <dd className="text-2xl font-display font-semibold">{result.stats.visitors ?? '—'}</dd>
              {delta(result.stats.visitors, result.previous?.visitors ?? null) != null && (
                <p className="text-xs text-text-muted mt-1">{delta(result.stats.visitors, result.previous?.visitors ?? null)}% vs periodo anterior</p>
              )}
            </div>
            <div className="rounded-[12px] border border-subtle bg-surface p-5">
              <dt className="text-sm text-text-muted">Páginas vistas</dt>
              <dd className="text-2xl font-display font-semibold">{result.stats.pageviews ?? '—'}</dd>
              {delta(result.stats.pageviews, result.previous?.pageviews ?? null) != null && (
                <p className="text-xs text-text-muted mt-1">{delta(result.stats.pageviews, result.previous?.pageviews ?? null)}% vs periodo anterior</p>
              )}
            </div>
          </dl>
          <div className="grid md:grid-cols-3 gap-4">
            <MetricList title="Procedencia (dominio)" rows={result.referrers} empty="Sin procedencia en este periodo." />
            <MetricList title="Dispositivos" rows={result.devices} empty="Sin datos de dispositivo." />
            <MetricList title="Conversiones agregadas" rows={result.conversions} empty="Aún no hay eventos de conversión." />
          </div>
        </>
      )}
    </div>
  );
}

function MetricList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ x: string; y: number }>;
  empty: string;
}) {
  return (
    <section className="rounded-[12px] border border-subtle bg-surface p-5">
      <h3 className="font-display font-semibold text-sm mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="text-sm space-y-2">
          {rows.map((row) => (
            <li key={row.x} className="flex justify-between gap-3">
              <span className="truncate">{row.x}</span>
              <span className="font-medium">{row.y}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
