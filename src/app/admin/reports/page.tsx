import Link from 'next/link';
import { requireAdminContext } from '@/lib/request-context';
import { listProblemReports } from '@/lib/problem-reports';
import { getServerTranslations } from '@/lib/i18n/server';
import { reportStepLabel } from '@/lib/problem-report-copy';

export const dynamic = 'force-dynamic';
export default async function ReportsPage({ searchParams }: { searchParams?: { requestId?: string; page?: string } }) {
  await requireAdminContext();
  const { language } = getServerTranslations(), en = language === 'en';
  const requestId = typeof searchParams?.requestId === 'string' ? searchParams.requestId.slice(0, 128) : '';
  const result = await listProblemReports(requestId, Number(searchParams?.page || 1));
  const href = (page: number) => `/admin/reports?${new URLSearchParams({ requestId, page: String(page) })}`;
  return <section className="space-y-5">
    <div className="space-y-2"><h2 className="text-xl font-semibold font-display text-text">{en ? 'User problem reports' : 'Avisos de usuarios'}</h2>
      <p className="text-sm text-text-muted">{en ? 'Explicit reports from the last 30 days. Comments are unverified user input. Request references link to the operational error index.' : 'Avisos enviados expresamente durante los últimos 30 días. Los comentarios son texto de usuarios sin verificar. Las referencias enlazan con el registro de errores operativos.'}</p></div>
    <form action="/admin/reports" className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium text-text">{en ? 'Request ID' : 'ID de petición'}
        <input name="requestId" defaultValue={requestId} maxLength={128} className="min-h-11 rounded-lg border border-control bg-surface px-3 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" /></label>
      <button className="min-h-11 rounded-lg border border-control bg-surface-muted px-4 font-semibold text-text">{en ? 'Search' : 'Buscar'}</button>
      <Link href="/admin/reports" className="min-h-11 px-4 py-3 text-sm text-text-muted underline">{en ? 'Clear' : 'Limpiar'}</Link>
    </form>
    <p className="text-sm text-text-muted">{result.total} {en ? 'reports' : 'avisos'}</p>
    <div className="space-y-4">{result.rows.map(row => <article key={row.id} className="rounded-xl border border-subtle bg-surface p-4 space-y-3 min-w-0">
      <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold text-text">{reportStepLabel(row.step, language)}</p>
        <time className="text-sm text-text-muted" dateTime={row.createdAt.toISOString()}>{new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Madrid' }).format(row.createdAt)}</time></div>
      <p className="whitespace-pre-wrap break-words text-sm text-text [overflow-wrap:anywhere]">{row.comment || (en ? 'No comment provided.' : 'Sin comentario.')}</p>
      <dl className="space-y-2 text-xs text-text-muted"><div><dt className="inline">{en ? 'Route' : 'Ruta'}: </dt><dd className="inline font-mono">{row.route}</dd></div>
        <div><dt className="inline">{en ? 'Report ID' : 'ID del aviso'}: </dt><dd className="inline break-all font-mono">{row.id}</dd></div>
        <div><dt className="inline">{en ? 'Request ID' : 'ID de petición'}: </dt><dd className="inline break-all font-mono">{row.requestId || '—'}</dd></div></dl>
      {row.requestId && <Link href={`/admin/errors?${new URLSearchParams({ requestId: row.requestId })}`} className="inline-flex min-h-11 items-center text-sm underline text-text">{en ? 'Find related errors' : 'Buscar errores relacionados'}</Link>}
    </article>)}</div>
    {!result.rows.length && <p className="text-sm text-text-muted">{en ? 'No reports with these filters.' : 'No hay avisos con estos filtros.'}</p>}
    <nav aria-label={en ? 'Report pages' : 'Páginas de avisos'} className="flex justify-between items-center text-sm">
      {result.page > 1 ? <Link href={href(result.page - 1)} className="min-h-11 py-3 underline">{en ? 'Previous' : 'Anterior'}</Link> : <span />}
      <span>{result.page} / {result.pages}</span>
      {result.page < result.pages ? <Link href={href(result.page + 1)} className="min-h-11 py-3 underline">{en ? 'Next' : 'Siguiente'}</Link> : <span />}
    </nav>
  </section>;
}
