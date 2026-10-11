'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ScrollText, Search, Users, X } from 'lucide-react';
import CrmColumnHeaderMenu from '@/components/crm/CrmColumnHeaderMenu';
import { CrmPagination } from '@/components/crm/CrmControls';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { CrmColumn, CrmFilter } from '@/lib/crm-views';
import { adminOptionLabel } from '@/lib/admin/table-filters';

type TableQuery = {
  q: string;
  sort: string;
  dir: 'asc' | 'desc';
  columnFilters: CrmFilter[];
  page: number;
  pageSize: number;
};

export default function AdminDataTable({ kind, columns, query, total, rows }: {
  kind: 'users' | 'audit';
  columns: CrmColumn[];
  query: TableQuery;
  total: number;
  rows: { id: string; cells: Record<string, ReactNode> }[];
}) {
  const { language, t } = useLanguage(), en = language === 'en';
  const router = useRouter(), pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.q);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const label = (column: CrmColumn) => column.label[en ? 1 : 0];
  const title = kind === 'users' ? (en ? 'Users' : 'Usuarios') : (en ? 'Audit' : 'Auditoría');
  const Icon = kind === 'users' ? Users : ScrollText;

  useEffect(() => {
    if (!pending && !timer.current) setSearch(query.q);
  }, [query.q, pending]);
  useEffect(() => () => clearTimeout(timer.current), []);

  function navigate(patch: Partial<TableQuery>) {
    clearTimeout(timer.current);
    timer.current = undefined;
    const next = { ...query, page: 1, ...patch };
    const params = new URLSearchParams();
    if (next.q.trim()) params.set('q', next.q.trim());
    if (next.columnFilters.length) params.set('columnFilters', JSON.stringify(next.columnFilters));
    params.set('sort', next.sort);
    params.set('dir', next.dir);
    if (next.page > 1) params.set('page', String(next.page));
    if (next.pageSize !== 25) params.set('pageSize', String(next.pageSize));
    startTransition(() => router.push(`${pathname}?${params}`, { scroll: false }));
  }

  function setFilter(column: string, filter: CrmFilter | null) {
    navigate({ q: search, columnFilters: [...query.columnFilters.filter(item => item.column !== column), ...(filter ? [filter] : [])] });
  }

  function filterSummary(filter: CrmFilter) {
    if (filter.operator === 'in') return filter.values?.map(value => adminOptionLabel(filter.column, value, en)).join(', ');
    if (filter.operator === 'customRange') return `${filter.startDate || '…'} – ${filter.endDate || '…'}`;
    if (filter.value) return `${t(`applications.columns.headerMenu.filterOperators.${filter.operator}`)}: ${filter.value}`;
    const dateKeys: Record<string, string> = { today: 'dateToday', last3Days: 'dateLast3Days', last7Days: 'dateLast7Days' };
    return t(dateKeys[filter.operator] ? `applications.columns.headerMenu.${dateKeys[filter.operator]}` : `applications.columns.headerMenu.filterOperators.${filter.operator}`);
  }

  return (
    <section className="w-full space-y-4" aria-busy={pending}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-text font-display">
            <Icon className="h-6 w-6 text-ai stroke-[1.75]" aria-hidden="true" />{title}
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            {en ? 'Click a column heading to filter or sort.' : 'Pulsa una cabecera para filtrar u ordenar.'}
          </p>
        </div>
        <form onSubmit={event => { event.preventDefault(); navigate({ q: search }); }} className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
          <input
            type="search" aria-label={en ? 'Search' : 'Buscar'} value={search}
            onChange={event => {
              const value = event.target.value;
              setSearch(value);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => navigate({ q: value }), 300);
            }}
            placeholder={kind === 'users' ? (en ? 'Name, email or ID…' : 'Nombre, correo o id…') : (en ? 'Search events or users…' : 'Buscar eventos o usuarios…')}
            className="min-h-11 w-full rounded-[8px] border border-control bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </form>
      </div>

      <fieldset disabled={pending} className="min-w-0 space-y-3">
        {query.columnFilters.length > 0 || query.q ? (
          <div className="flex flex-wrap items-center gap-2">
            {query.columnFilters.map(filter => {
              const column = columns.find(item => item.id === filter.column)!;
              return <button key={filter.column} type="button" onClick={() => setFilter(filter.column, null)}
                aria-label={`${en ? 'Remove filter' : 'Quitar filtro'}: ${label(column)}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-subtle bg-surface px-3 text-xs text-text">
                <span><span className="font-semibold">{label(column)}:</span> {filterSummary(filter)}</span>
                <X className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
              </button>;
            })}
            <button type="button" onClick={() => { setSearch(''); navigate({ q: '', columnFilters: [] }); }} className="min-h-11 px-3 text-xs font-semibold text-text-muted hover:text-text">
              {en ? 'Clear filters' : 'Limpiar filtros'}
            </button>
          </div>
        ) : null}

        <div>
          <div className="overflow-hidden rounded-t-[12px] border border-b-0 border-subtle bg-surface shadow-sm">
            <div className="max-h-[calc(100dvh-300px)] min-h-48 overflow-auto scrollbar-custom">
              <table className="min-w-full text-left text-xs font-sans">
                <caption className="sr-only">{title}</caption>
                <thead className="sticky top-0 z-10 bg-surface-muted text-[10px] uppercase tracking-wider text-text-muted font-display dark:bg-canvas">
                  <tr>{columns.map(column => <th key={column.id} scope="col"
                    aria-sort={query.sort === column.id ? query.dir === 'asc' ? 'ascending' : 'descending' : 'none'}
                    className="whitespace-nowrap px-3 py-3 font-bold">
                    <CrmColumnHeaderMenu
                      column={column.id} columnDefinitions={columns} label={label(column)} sortable filterable
                      groupable={false} layoutControls={false} grouping={null}
                      sort={{ key: query.sort, direction: query.dir }}
                      columnFilter={query.columnFilters.find(filter => filter.column === column.id)}
                      optionLabel={value => adminOptionLabel(column.id, value, en)}
                      width="auto" canMoveLeft={false} canMoveRight={false}
                      onSetSort={(sort, dir) => navigate({ q: search, sort, dir })}
                      onSetColumnFilter={filter => setFilter(column.id, filter)}
                      onSetGrouping={() => {}} onSetWidth={() => {}} onMove={() => {}}
                    />
                  </th>)}</tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {rows.length ? rows.map(row => <tr key={row.id} className="group transition-colors hover:bg-canvas/70">
                    {columns.map(column => <td key={column.id} className="px-3 py-2.5 align-middle">{row.cells[column.id]}</td>)}
                  </tr>) : <tr><td colSpan={columns.length} className="px-4 py-12 text-center">
                    <p className="font-display text-sm font-semibold text-text">{en ? 'No results' : 'Sin resultados'}</p>
                    <p className="mt-2 text-sm text-text-muted">{en ? 'Try another search or change the column filters.' : 'Prueba otra búsqueda o cambia los filtros de las columnas.'}</p>
                  </td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <CrmPagination total={total} page={query.page} pageSize={query.pageSize} itemsCount={rows.length}
            onPage={page => navigate({ q: search, page })} onPageSize={pageSize => navigate({ q: search, pageSize })} />
        </div>
      </fieldset>
      <span role="status" className="sr-only">{pending ? (en ? 'Loading results…' : 'Cargando resultados…') : ''}</span>
    </section>
  );
}
