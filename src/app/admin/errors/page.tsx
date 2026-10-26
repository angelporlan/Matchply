import Link from 'next/link';
import { requireAdminContext } from '@/lib/request-context';
import { listOperationalErrors } from '@/lib/error-events';
import { getServerTranslations } from '@/lib/i18n/server';
import { userErrorMessage } from '@/lib/user-errors';

export const dynamic = 'force-dynamic';

export default async function ErrorsPage({ searchParams }: { searchParams?: { requestId?: string; page?: string } }) {
  await requireAdminContext();
  const { language } = getServerTranslations();
  const en = language === 'en';
  const requestId = typeof searchParams?.requestId === 'string' ? searchParams.requestId.slice(0, 128) : '';
  const result = await listOperationalErrors(requestId, Number(searchParams?.page || 1));
  const href = (page: number) => `/admin/errors?${new URLSearchParams({ requestId, page: String(page) })}`;
  return <section className="space-y-5">
    <div className="space-y-2">
      <h2 className="text-xl font-semibold font-display text-text">{en ? 'Operational errors' : 'Errores operativos'}</h2>
      <p className="text-sm text-text-muted">{en ? 'Last 30 days. Search the request reference to correlate browser, server and worker logs. Technical exception details remain in the server logs.' : 'Últimos 30 días. Busca la referencia de la petición para correlacionar navegador, servidor y workers. Los detalles técnicos de las excepciones permanecen en los logs del servidor.'}</p>
    </div>
    <form className="flex flex-wrap items-end gap-3" action="/admin/errors">
      <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-medium text-text">{en ? 'Request ID or error digest' : 'ID de petición o referencia del error'}
        <input name="requestId" defaultValue={requestId} maxLength={128} className="min-h-11 rounded-lg border border-control bg-surface px-3 font-mono text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" />
      </label>
      <button className="min-h-11 rounded-lg border border-control bg-surface-muted px-4 font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">{en ? 'Search' : 'Buscar'}</button>
      <Link href="/admin/errors" className="min-h-11 rounded-lg px-4 py-3 text-sm text-text-muted underline">{en ? 'Clear' : 'Limpiar'}</Link>
    </form>
    <p className="text-sm text-text-muted">{result.total} {en ? 'records' : 'registros'}</p>
    <div className="overflow-x-auto rounded-xl border border-subtle bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface-muted text-text-muted"><tr>{[en ? 'Date' : 'Fecha', en ? 'Event / source' : 'Evento / origen', en ? 'Error' : 'Error', en ? 'Route' : 'Ruta', en ? 'References' : 'Referencias'].map(title => <th key={title} className="px-4 py-3 font-semibold">{title}</th>)}</tr></thead>
        <tbody>{result.rows.map(row => <tr key={row.id} className="border-t border-subtle align-top">
          <td className="whitespace-nowrap px-4 py-3 text-text-muted">{new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Madrid' }).format(row.createdAt)}</td>
          <td className="px-4 py-3"><span className="font-mono">{row.event}</span><p className="mt-1 text-text-muted">{row.source}</p></td>
          <td className="min-w-64 px-4 py-3"><span className="font-mono">{row.code}</span><p className="mt-1 text-text-muted">{userErrorMessage(row.code, language)}</p></td>
          <td className="px-4 py-3 font-mono">{row.route}</td>
          <td className="min-w-72 space-y-1 px-4 py-3 font-mono text-xs"><p className="break-all">requestId: {row.requestId}</p>{row.traceId && row.traceId !== row.requestId && <p className="break-all">traceId: {row.traceId}</p>}{row.digest && <p>digest: {row.digest}</p>}</td>
        </tr>)}</tbody>
      </table>
      {!result.rows.length && <p className="p-6 text-sm text-text-muted">{en ? 'No matching errors.' : 'No hay errores con estos filtros.'}</p>}
    </div>
    <nav aria-label={en ? 'Error pages' : 'Páginas de errores'} className="flex items-center justify-between text-sm">
      {result.page > 1 ? <Link href={href(result.page - 1)} className="min-h-11 py-3 underline">{en ? 'Previous' : 'Anterior'}</Link> : <span />}
      <span>{result.page} / {result.pages}</span>
      {result.page < result.pages ? <Link href={href(result.page + 1)} className="min-h-11 py-3 underline">{en ? 'Next' : 'Siguiente'}</Link> : <span />}
    </nav>
  </section>;
}
