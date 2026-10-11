import Link from 'next/link';
import { requireAdminContext } from '@/lib/request-context';
import { AdminErrorState } from '@/components/admin/AdminStates';
import { AI_USAGE_PAGE_SIZE, loadAiUsageReport, parseUsageReportFilters, type UsageTotals } from '@/lib/ai-usage-report';

export const dynamic = 'force-dynamic';
const number = (n: number | null) => n === null ? 'N/D' : new Intl.NumberFormat('es-ES').format(n);
const money = (n: number | string | null) => n === null ? 'No disponible' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(Number(n));
const labels: Record<string, string> = { match_batch: 'Matching de ofertas', import_offer: 'Recuperar descripción de oferta', networking: 'Networking', research: 'Investigación de ofertas', import_cv: 'Importar CV', outreach: 'Carta y preparación de entrevista', admin_model_test: 'Prueba de modelo', 'profile:extract': 'Extraer perfil', 'profile:start_interview': 'Entrevista de perfil', 'profile:generate_questions': 'Preguntas de perfil', 'profile:synthesize_profile': 'Crear perfil', 'profile:polish_section': 'Pulir perfil' };
const functionName = (key: string) => labels[key] ?? (key.startsWith('optimize_cv:') ? `Optimizar CV · ${key.slice(12)}` : key);
const th = 'px-4 py-3 text-left font-medium whitespace-nowrap';
const td = 'px-4 py-3 align-top';
const control = 'min-h-[44px] rounded-lg border border-control bg-surface px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

function TotalCells({ row }: { row: UsageTotals }) {
  return <><td className={td}>{number(row.requests)}</td><td className={td}>{number(row.inputReportedRequests === 0 ? null : row.inputTokens)}</td><td className={td}>{number(row.outputReportedRequests === 0 ? null : row.outputTokens)}</td><td className={td}>{money(row.missingCost === row.requests ? null : row.costUsd)}{row.missingCost > 0 && <div className="text-xs text-text-muted mt-1">{number(row.missingCost)} sin coste</div>}</td></>;
}
function Pagination({ page, count, href }: { page: number; count: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(count / AI_USAGE_PAGE_SIZE));
  return <nav aria-label="Paginación" className="flex items-center justify-between gap-3 text-sm mt-3">
    <span className="text-text-muted">Página {page} de {pages} · {number(count)} registros</span>
    <div className="flex gap-2">{page > 1 && <Link href={href(page - 1)} className={`${control} inline-flex items-center`}>Anterior</Link>}{page < pages && <Link href={href(page + 1)} className={`${control} inline-flex items-center`}>Siguiente</Link>}</div>
  </nav>;
}

export default async function AdminAiUsagePage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireAdminContext();
  const filters = parseUsageReportFilters(searchParams);
  const href = (changes: Record<string, string | number | undefined>) => {
    const values: Record<string, string | number | undefined> = { days: filters.days, user: filters.userId, function: filters.functionKey, q: filters.query, usersPage: filters.userPage, requestsPage: filters.requestPage, ...changes };
    const query = new URLSearchParams(); for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== '') query.set(key, String(value));
    return `/admin/ai/usage?${query}`;
  };
  try {
    const report = await loadAiUsageReport(filters); const t = report.totals;
    return <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div><h2 className="text-2xl font-display font-semibold">Consumo de IA</h2><p className="text-sm text-text-muted mt-1">Tokens y coste de las consultas a los proveedores.</p></div>
        <Link href="/admin/ai" className={`${control} inline-flex items-center`}>Configuración de IA</Link>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm"><span className="block">Periodo</span><select name="days" defaultValue={filters.days} className={control}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option></select></label>
        <label className="space-y-1 text-sm"><span className="block">Función</span><select name="function" defaultValue={filters.functionKey ?? ''} className={`${control} max-w-full`}><option value="">Todas las funciones</option>{report.availableFunctions.map(row => <option key={row.functionKey} value={row.functionKey}>{functionName(row.functionKey)}</option>)}</select></label>
        {filters.userId && <input type="hidden" name="user" value={filters.userId} />}
        <button className={`${control} font-semibold`} type="submit">Aplicar filtros</button>
        <Link href={href({})} className={`${control} inline-flex items-center`}>Actualizar</Link>
      </form>
      {filters.userId && <div className="rounded-lg bg-ai-surface text-ai-text p-4 text-sm flex flex-wrap items-center justify-between gap-3"><span>Consumo de {report.selectedUser?.email ?? filters.userId}</span><Link className="underline min-h-[44px] inline-flex items-center" href={href({ user: undefined, usersPage: 1, requestsPage: 1 })}>Ver todos los usuarios</Link></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Coste registrado (USD)', money(t.requests > 0 && t.missingCost === t.requests ? null : t.costUsd), `${money(t.reportedCostUsd)} informado · ${money(t.estimatedCostUsd)} estimado`],
          ['Tokens de entrada', number(t.requests > 0 && t.inputReportedRequests === 0 ? null : t.inputTokens), `${number(t.cachedInputTokens)} en caché (incluidos)`],
          ['Tokens de salida', number(t.requests > 0 && t.outputReportedRequests === 0 ? null : t.outputTokens), `${number(t.reasoningTokens)} de razonamiento (incluidos)`],
          ['Consultas al proveedor', number(t.requests), `${number(t.failedRequests)} ${t.failedRequests === 1 ? 'fallida' : 'fallidas'} · ${number(t.webSearchCalls)} ${t.webSearchCalls === 1 ? 'llamada web' : 'llamadas web'}`],
        ].map(([title, value, detail]) => <section key={title} className="rounded-xl border border-subtle bg-surface p-5"><h3 className="text-sm text-text-muted">{title}</h3><p className="text-2xl font-semibold font-display mt-2 break-words">{value}</p><p className="text-xs text-text-muted mt-2">{detail}</p></section>)}
      </div>
      <p className="text-sm text-text-muted">El registro empieza al activar esta función; las consultas anteriores no se reconstruyen. Los importes estimados usan tarifas publicadas en USD, sin impuestos ni descuentos de cuenta. Cada reintento cuenta como otra consulta. Los tokens de caché y razonamiento ya están incluidos en entrada y salida.</p>
      {(t.missingCost > 0 || t.missingTokens > 0) && <p className="rounded-lg bg-warning-surface text-warning-text p-4 text-sm">Datos parciales: {number(t.missingCost)} consultas sin coste y {number(t.missingTokens)} sin consumo completo. Los totales solo suman los datos disponibles.</p>}
      {t.requests === 0 ? <p className="rounded-xl border border-subtle bg-surface p-5 text-text-muted">Todavía no hay consultas registradas en este periodo. Aparecerán después del próximo uso de IA.</p> : <>
        <section className="rounded-xl border border-subtle bg-surface p-5"><h3 className="text-lg font-display font-semibold mb-3">Por función</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-muted"><tr>{['Función', 'Consultas', 'Entrada', 'Salida', 'Coste USD'].map(title => <th key={title} scope="col" className={th}>{title}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{report.functions.map(row => <tr key={row.functionKey}><td className={td}>{functionName(row.functionKey)}</td><TotalCells row={row} /></tr>)}</tbody></table></div></section>
        <section className="rounded-xl border border-subtle bg-surface p-5"><h3 className="text-lg font-display font-semibold mb-3">Por usuario</h3>
          <form method="get" className="flex flex-wrap gap-2 items-end mb-4"><input type="hidden" name="days" value={filters.days} />{filters.functionKey && <input type="hidden" name="function" value={filters.functionKey} />}{filters.userId && <input type="hidden" name="user" value={filters.userId} />}<label className="text-sm space-y-1"><span className="block">Buscar usuario por nombre o correo</span><input name="q" defaultValue={filters.query} className={`${control} w-72 max-w-full`} /></label><button type="submit" className={control}>Buscar</button></form>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-muted"><tr>{['Usuario', 'Consultas', 'Entrada', 'Salida', 'Coste USD'].map(title => <th key={title} scope="col" className={th}>{title}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{report.users.map(row => <tr key={row.userId ?? 'unattributed'}><td className={td}>{row.userId ? <Link className="underline text-ai-text" href={href({ user: row.userId, q: undefined, usersPage: 1, requestsPage: 1 })}>{row.email ?? row.userId}</Link> : 'Sin usuario / cuenta eliminada'}{row.name && <div className="text-xs text-text-muted mt-1">{row.name}</div>}</td><TotalCells row={row} /></tr>)}</tbody></table></div>
          {report.users.length === 0 && <p className="text-sm text-text-muted py-3">No hay usuarios que coincidan con la búsqueda.</p>}
          <Pagination page={filters.userPage} count={report.userCount} href={page => href({ usersPage: page })} />
        </section>
        <section className="rounded-xl border border-subtle bg-surface p-5"><h3 className="text-lg font-display font-semibold mb-3">Detalle de consultas</h3><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-surface-muted"><tr>{['Fecha / usuario', 'Función / modelo', 'Tokens', 'Coste USD', 'Estado'].map(title => <th key={title} scope="col" className={th}>{title}</th>)}</tr></thead><tbody className="divide-y divide-border-subtle">{report.recent.map(row => <tr key={row.id}>
          <td className={td}>{row.createdAt.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}<div className="text-xs text-text-muted mt-1">{row.email ?? 'Sin usuario / cuenta eliminada'}</div></td>
          <td className={td}>{functionName(row.functionKey)}<div className="text-xs text-text-muted mt-1">{row.provider} · {row.model}</div><div className="text-xs text-text-muted mt-1">{row.endpoint}</div></td>
          <td className={`${td} whitespace-nowrap`}>{number(row.inputTokens)} entrada<br />{number(row.outputTokens)} salida{(row.cachedInputTokens ?? 0) > 0 && <div className="text-xs text-text-muted mt-1">{number(row.cachedInputTokens)} en caché</div>}{row.webSearchCalls > 0 && <div className="text-xs text-text-muted mt-1">{row.webSearchCalls} llamadas web</div>}</td>
          <td className={`${td} whitespace-nowrap`}>{money(row.costUsd)}<div className="text-xs text-text-muted mt-1">{row.costSource === 'reported' ? 'Informado por proveedor' : row.costSource === 'estimated' ? 'Estimado' : 'Sin tarifa o consumo'}</div></td>
          <td className={td}><span className={row.success ? 'text-success-text' : 'text-danger-text'}>{row.success ? 'Respuesta recibida' : 'Error de consulta'}</span><div className="text-xs text-text-muted mt-1">{number(row.latencyMs)} ms{row.errorCode && ` · ${row.errorCode}`}</div></td>
        </tr>)}</tbody></table></div><Pagination page={filters.requestPage} count={report.requestCount} href={page => href({ requestsPage: page })} /></section>
      </>}
    </div>;
  } catch (error) { return <AdminErrorState title="No se pudo cargar el consumo de IA" description={error instanceof Error ? error.message : 'Inténtalo de nuevo.'} />; }
}
