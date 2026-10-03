'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, Users, Plus, Search, X, Filter, Star, Download, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { replaceUrlQuery } from '@/lib/client-url';
import { crmColumns, defaultCrmConfig, normalizeCrmConfig, systemCrmViews, type CrmConfig, type CrmPage, type CrmRow, type ListEntity, type SavedCrmView } from '@/lib/crm-views';
import { PERSON_STATUSES } from '@/lib/people/types';
import { statusLabel, kindLabel } from '@/components/people/ui';
import PersonStatusSelect, { PersonBulkStatusSelect } from '@/components/people/PersonStatusSelect';
import { queryCrmAction, queryCrmIdsAction, setRowsFavoriteAction, setPeopleStatusAction, exportCrmRowsAction } from '@/app/dashboard/applications/crm-actions';
import { createCrmView, updateCrmView, deleteCrmView, setDefaultCrmView } from '@/app/dashboard/applications/view-actions';
import { formatDataAsCsv, formatDataAsTsv, triggerCsvDownload } from '@/lib/export-helpers';
import { Button } from '@/components/ui/Button';
import CrmViewsMenu from './CrmViewsMenu';
import CrmColumnsMenu from './CrmColumnsMenu';
import CrmColumnHeaderMenu from './CrmColumnHeaderMenu';
import CrmTable from './CrmTable';
import { CrmDialog, CrmPagination } from './CrmControls';

export type CrmWorkspaceProps = {
  entity: ListEntity; initialData: CrmPage; savedViews: SavedCrmView[]; initialViewId: string; initialConfig: CrmConfig;
  lookups?: { id: string; name: string }[]; onCreate: () => void; onDelete: (row: CrmRow) => Promise<string | void>;
  onDeleteSelected?: (ids: string[]) => Promise<string | void>; renderCell: (row: CrmRow, key: string) => ReactNode; children?: ReactNode;
};
export default function CrmWorkspace(props: CrmWorkspaceProps) {
  const { entity, initialData, savedViews: initialViews, initialViewId, initialConfig, lookups = [], onCreate, onDelete, onDeleteSelected, renderCell, children } = props;
  const { t, language } = useLanguage(), en = language === 'en', router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const tx = (es: string, english: string) => en ? english : es, defs = crmColumns(entity), systems = systemCrmViews(entity);
  const [views, setViews] = useState(initialViews), [active, setActive] = useState(initialViewId), [config, setConfig] = useState(() => normalizeCrmConfig(entity, initialConfig));
  const [data, setData] = useState(initialData), [page, setPage] = useState(initialData.page), [selected, setSelected] = useState<Set<string>>(new Set()), [pending, setPending] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [reload, setReload] = useState(0), [filtersOpen, setFiltersOpen] = useState(false), [exportOpen, setExportOpen] = useState(false), [exportFields, setExportFields] = useState<string[]>(config.columns), [exportBusy, setExportBusy] = useState(false);
  const request = useRef(0), skipFirst = useRef(true), mutationBusy = useRef(false);
  const queryKey = JSON.stringify({ filters: config.filters, sort: config.sort, pageSize: config.pageSize });
  const currentConfig = useRef(config); currentConfig.current = config;
  const currentPage = useRef(page); currentPage.current = page;
  const queryAtMutation = useRef(queryKey); queryAtMutation.current = queryKey;
  useEffect(() => {
    const initial = normalizeCrmConfig(entity, initialConfig), current = currentConfig.current;
    const query = (value: CrmConfig) => JSON.stringify({ filters: value.filters, sort: value.sort, pageSize: value.pageSize });
    if (query(initial) === query(current) && initialData.page === currentPage.current) setData(initialData);
    else setReload(value => value + 1);
  }, [entity, initialData, initialConfig]);
  useEffect(() => {
    if (skipFirst.current) { skipFirst.current = false; return; }
    const serial = ++request.current;
    const timer = setTimeout(() => {
      setBusy(true);
      queryCrmAction(entity, currentConfig.current, page).then(result => {
        if (serial !== request.current) return;
        if ('data' in result) { setData(result.data); if (result.data.page !== page) setPage(result.data.page); }
        else setMessage(tx('No se pudo cargar la tabla. Vuelve a intentarlo.', 'Could not load the table. Retry.'));
        setBusy(false);
      }).catch(() => { if (serial === request.current) { setBusy(false); setMessage(tx('No se pudo cargar la tabla.', 'Could not load the table.')); } });
    }, 200);
    return () => { clearTimeout(timer); request.current = serial + 1; };
    // queryKey contains exactly the normalized server query; visual changes do not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, queryKey, page, reload]);
  function change(next: CrmConfig) {
    const normalized = normalizeCrmConfig(entity, next);
    if (JSON.stringify({ filters: normalized.filters, sort: normalized.sort, pageSize: normalized.pageSize }) !== queryKey) { setPage(1); setSelected(new Set()); }
    setConfig(normalized);
  }
  function remember(id: string) {
    try { localStorage.setItem(`${entity}.view`, id); document.cookie = `${entity}_view=${id}; path=/; max-age=31536000; SameSite=Lax`; } catch {}
    const next = new URLSearchParams(params.toString()); next.set('view', id); ['q', 'status', 'due', 'page', 'companyId', 'offerId', 'new'].forEach(key => next.delete(key)); replaceUrlQuery(pathname, next);
  }
  function selectView(id: string, sync = true) {
    const next = views.find(v => v.id === id)?.config || systems.find(v => v.id === id)?.config;
    if (!next) return;
    change(normalizeCrmConfig(entity, next)); setPage(1); setSelected(new Set()); setActive(id); if (sync) remember(id);
  }
  const requestedView = params.get('view');
  useEffect(() => {
    if (requestedView && requestedView !== active) selectView(requestedView, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedView]);
  const base = normalizeCrmConfig(entity, views.find(v => v.id === active)?.config || systems.find(v => v.id === active)?.config);
  const dirty = JSON.stringify(normalizeCrmConfig(entity, config)) !== JSON.stringify(base);
  async function save(mode: 'create' | 'update' | 'rename', name?: string) {
    setSaving(true);
    try {
      const result = mode === 'create' ? await createCrmView(entity, name!, config) : await updateCrmView(entity, active, mode === 'rename' ? { name } : { config });
      if (!result.view) { setMessage(result.error === 'DUPLICATE_NAME' ? t('applications.views.toasts.duplicate') : t('applications.views.toasts.error')); return; }
      const view: SavedCrmView = { id: result.view.id, name: result.view.name, isDefault: result.view.isDefault, config: normalizeCrmConfig(entity, result.view.config) };
      setViews(prev => [...prev.filter(v => v.id !== view.id), view]); setActive(view.id); remember(view.id); setMessage(t('applications.views.toasts.saved'));
    } catch { setMessage(t('applications.views.toasts.error')); } finally { setSaving(false); }
  }
  async function removeView() {
    if (!window.confirm(t('applications.views.deleteConfirm'))) return;
    const result = await deleteCrmView(entity, active);
    if (result.error) { setMessage(t('applications.views.toasts.error')); return; }
    setViews(prev => prev.filter(v => v.id !== active)); selectView('all');
  }
  function select(ids: string[], checked: boolean) { setSelected(prev => { const next = new Set(prev); ids.forEach(id => checked ? next.add(id) : next.delete(id)); return next; }); }
  async function selectAll() {
    const key = queryKey, result = await queryCrmIdsAction(entity, config);
    if (key !== queryAtMutation.current) return;
    if (!('ids' in result)) { setMessage(tx('No se pudo seleccionar la tabla.', 'Could not select the table.')); return; }
    setSelected(new Set(result.ids));
    if (result.truncated) setMessage(tx('Se han seleccionado los primeros 10.000 resultados.', 'The first 10,000 results were selected.'));
  }
  async function favorite(ids: string[], value: boolean) {
    if (mutationBusy.current || !ids.length) return;
    mutationBusy.current = true; setPending(new Set(ids));
    const previous = new Map(data.items.filter(r => ids.includes(r.id)).map(r => [r.id, r.isFavorite]));
    setData(prev => ({ ...prev, items: prev.items.map(r => ids.includes(r.id) ? { ...r, isFavorite: value } : r) }));
    try {
      const result = await setRowsFavoriteAction(entity, ids, value);
      if ('error' in result) throw new Error(result.error);
      if (currentConfig.current.filters.favoritesOnly && !value) setSelected(prev => new Set(Array.from(prev).filter(id => !ids.includes(id))));
      setReload(n => n + 1);
    } catch {
      setData(prev => ({ ...prev, items: prev.items.map(r => previous.has(r.id) ? { ...r, isFavorite: previous.get(r.id)! } : r) }));
      setMessage(tx('No se pudo guardar el favorito. Vuelve a intentarlo.', 'Could not save the favorite. Retry.'));
    } finally { mutationBusy.current = false; setPending(new Set()); }
  }
  async function status(ids: string[], value: string) {
    if (mutationBusy.current || !ids.length) return;
    mutationBusy.current = true; setPending(new Set(ids));
    try { const result = await setPeopleStatusAction(ids, value); if ('error' in result) throw new Error(); setReload(n => n + 1); } catch { setMessage(tx('No se pudo cambiar el estado.', 'Could not change the status.')); } finally { mutationBusy.current = false; setPending(new Set()); }
  }
  async function remove(row?: CrmRow) {
    if (!window.confirm(row ? tx(`¿Eliminar ${row.name}?`, `Delete ${row.name}?`) : tx('¿Quitar las empresas seleccionadas? Las que tengan trabajos se conservarán.', 'Remove selected companies? Companies with jobs will be kept.'))) return;
    try { const result = row ? await onDelete(row) : await onDeleteSelected?.(Array.from(selected)); if (result) setMessage(result); setSelected(new Set()); setReload(n => n + 1); } catch { setMessage(tx('No se pudo eliminar el registro.', 'Could not delete the record.')); }
  }
  const optionLabel = (value: string) => PERSON_STATUSES.includes(value as typeof PERSON_STATUSES[number]) ? statusLabel(value, en) : kindLabel(value, en);
  const cell = (row: CrmRow, key: string) =>
    entity === 'people' && key === 'status' ? (
      <PersonStatusSelect
        status={String(row.status)}
        saving={pending.has(row.id)}
        disabled={pending.size > 0}
        ariaLabel={`${tx('Estado', 'Status')}: ${row.name}`}
        onChange={(value) => void status([row.id], value)}
      />
    ) : (
      renderCell(row, key)
    );
  async function exportRows(copy: boolean) {
    if (!exportFields.length || selected.size > 1000) { setMessage(tx('Selecciona campos y un máximo de 1.000 filas para exportar.', 'Select fields and at most 1,000 rows to export.')); return; }
    setExportBusy(true);
    try {
      const result = await exportCrmRowsAction(entity, Array.from(selected)); if (!('rows' in result)) throw new Error();
      const columns = exportFields.map(key => ({ key, label: key === 'isFavorite' ? tx('Favorito', 'Favorite') : defs.find(c => c.id === key)!.label[en ? 1 : 0] }));
      const rows = result.rows.map(r => Object.fromEntries(columns.map(({ key }) => [key, defs.find(c => c.id === key)?.kind === 'date' && r[key] ? new Date(r[key] as string).toLocaleDateString(en ? 'en-GB' : 'es-ES') : ['status', 'kind'].includes(key) ? optionLabel(String(r[key])) : key === 'isFavorite' ? r.isFavorite ? tx('Sí', 'Yes') : tx('No', 'No') : r[key] ?? ''])));
      if (copy) await navigator.clipboard.writeText(formatDataAsTsv(rows, columns)); else triggerCsvDownload(formatDataAsCsv(rows, columns), `${entity}-matchply-${new Date().toISOString().slice(0, 10)}.csv`);
      setExportOpen(false); setMessage(copy ? tx('Datos copiados.', 'Data copied.') : tx('CSV descargado.', 'CSV downloaded.'));
    } catch { setMessage(tx('No se pudo exportar. Vuelve a intentarlo.', 'Could not export. Retry.')); } finally { setExportBusy(false); }
  }
  const title = entity === 'companies' ? tx('Empresas', 'Companies') : tx('Personas', 'People'), Icon = entity === 'companies' ? Building2 : Users;
  const additionalColumnFilters = (config.filters.columnFilters || []).filter(filter =>
    JSON.stringify(filter) !== JSON.stringify(base.filters.columnFilters?.find(original => original.column === filter.column)));
  const additionalFavorites = !!config.filters.favoritesOnly && !base.filters.favoritesOnly;
  const additionalDue = !!config.filters.due && !base.filters.due;
  const hasAdditionalFilters = Boolean(
    (config.filters.search && config.filters.search !== base.filters.search)
    || additionalFavorites || additionalDue
    || (config.filters.offerId && config.filters.offerId !== base.filters.offerId)
    || additionalColumnFilters.length);
  const clearAdditionalFilters = () => change({ ...config, filters: base.filters });
  function clearAdditionalColumn(column: string) {
    const original = base.filters.columnFilters?.find(filter => filter.column === column);
    change({ ...config, filters: { ...config.filters, columnFilters: [
      ...(config.filters.columnFilters || []).filter(filter => filter.column !== column),
      ...(original ? [original] : []),
    ] } });
  }
  return <div className="w-full" aria-busy={busy || undefined}>
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-5"><div><h1 className="text-2xl font-bold text-text tracking-tight flex items-center gap-2 font-display"><Icon className="w-6 h-6 text-ai stroke-[1.75]" />{title}</h1><p className="text-text-muted text-sm mt-1 font-sans">{entity === 'companies' ? tx('Agrupa tus trabajos y deja notas de seguimiento por empresa. Los datos de la ficha son compartidos.', 'Group your jobs and track company notes. Company profiles are shared.') : tx('Tu red profesional: filtra, ordena, elige columnas y guarda vistas.', 'Your professional network: filter, sort, choose columns and save views.')}</p></div><Button onClick={onCreate}><Plus className="w-4 h-4" />{entity === 'companies' ? tx('Nueva empresa', 'New company') : tx('Nueva persona', 'New person')}</Button></div>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4"><CrmViewsMenu views={[...systems.map(v => ({ id: v.id, name: v.name[en ? 1 : 0], isDefault: false, isSystem: true })), ...views.map(v => ({ ...v, isSystem: false }))]} activeViewId={active} isDirty={dirty} saving={saving} onSelect={selectView} onSave={() => void save('update')} onSaveAs={name => void save('create', name)} onRename={name => void save('rename', name)} onDelete={() => void removeView()} onRevert={() => change(base)} onSetDefault={() => { void setDefaultCrmView(entity, active).then(result => { if (result.error) setMessage(t('applications.views.toasts.error')); else setViews(prev => prev.map(v => ({ ...v, isDefault: v.id === active }))); }); }} />
      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end"><button type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(v => !v)} className="md:hidden inline-flex items-center gap-2 px-3 py-2.5 border border-subtle rounded-[8px] bg-surface text-xs font-bold text-text-muted"><Filter className="w-3.5 h-3.5" />{t('applications.columns.headerMenu.filterBy')}</button><CrmColumnsMenu options={defs.map(c => ({ id: c.id, label: c.label[en ? 1 : 0] }))} defaults={defaultCrmConfig(entity).columns} visibleColumns={config.columns} onChange={columns => change({ ...config, columns })} />
        <div className="relative flex-1 basis-full md:basis-auto md:w-80 lg:w-96 min-w-0"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" /><input type="search" value={config.filters.search || ''} onChange={e => change({ ...config, filters: { ...config.filters, search: e.target.value } })} aria-label={tx('Buscar', 'Search')} placeholder={entity === 'companies' ? tx('Buscar por nombre, ubicación o sector', 'Search by name, location or industry') : tx('Buscar por nombre o cargo', 'Search by name or role')} className="w-full bg-canvas border border-control rounded-[8px] pl-10 pr-4 py-3 text-sm text-text placeholder-text-muted focus-visible:ring-2 focus-visible:ring-ai font-sans" /></div>
      </div></div>
    {filtersOpen && <div className="md:hidden flex flex-wrap gap-3 p-3 mb-3 rounded-[12px] border border-subtle bg-surface"><label className="flex gap-2 items-center text-sm text-text"><input type="checkbox" checked={!!config.filters.favoritesOnly} onChange={e => change({ ...config, filters: { ...config.filters, favoritesOnly: e.target.checked } })} />{tx('Solo favoritos', 'Favorites only')}</label>{entity === 'people' && <label className="flex gap-2 items-center text-sm text-text"><input type="checkbox" checked={!!config.filters.due} onChange={e => change({ ...config, filters: { ...config.filters, due: e.target.checked } })} />{tx('Seguimientos pendientes', 'Follow-ups due')}</label>}{defs.map(def => <CrmColumnHeaderMenu key={def.id} column={def.id} columnDefinitions={defs} optionLabel={optionLabel} label={def.label[en ? 1 : 0]} sortable groupable filterable sort={config.sort} grouping={config.grouping} columnFilter={config.filters.columnFilters?.find(f => f.column === def.id)} width={config.columnWidths[def.id] || 'auto'} canMoveLeft={false} canMoveRight={false} onSetSort={(key, direction) => change({ ...config, sort: { key, direction } })} onSetGrouping={grouping => change({ ...config, grouping })} onSetColumnFilter={filter => change({ ...config, filters: { ...config.filters, columnFilters: [...(config.filters.columnFilters || []).filter(f => f.column !== def.id), ...(filter ? [filter] : [])] } })} onSetWidth={width => change({ ...config, columnWidths: { ...config.columnWidths, [def.id]: width } })} onMove={() => {}} lookupOptions={def.kind === 'relation' ? lookups : undefined} />)}</div>}
    {hasAdditionalFilters && <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-text-muted">{additionalFavorites && <span>{tx('Solo favoritos', 'Favorites only')}</span>}{additionalDue && <span>{tx('Seguimientos pendientes', 'Follow-ups due')}</span>}{additionalColumnFilters.map(f => <button key={f.column} type="button" onClick={() => clearAdditionalColumn(f.column)} className="inline-flex items-center gap-1 border border-subtle rounded-full px-2 py-1">{defs.find(d => d.id === f.column)?.label[en ? 1 : 0]}<X className="w-3 h-3" /></button>)}<button type="button" onClick={clearAdditionalFilters} className="underline">{tx('Limpiar filtros', 'Clear filters')}</button></div>}
    {message && <div role="status" className="flex items-center justify-between gap-3 mb-3 rounded-[8px] bg-surface-muted p-3 text-sm text-text"><span>{message}</span><button type="button" aria-label={tx('Cerrar aviso', 'Dismiss message')} onClick={() => setMessage('')}><X className="w-4 h-4" /></button></div>}
    {selected.size > 0 && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-ai/25 bg-ai/5 px-4 py-3"><div className="text-xs font-bold text-text">{selected.size} {tx('seleccionados', 'selected')} {selected.size < data.total && <button type="button" onClick={() => void selectAll()} className="text-ai ml-2 hover:underline">{tx(`Seleccionar todos los ${data.total}`, `Select all ${data.total}`)}</button>}</div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={pending.size > 0} onClick={() => void favorite(Array.from(selected), true)}><Star className="w-3.5 h-3.5" />{tx('Marcar favoritos', 'Mark favorites')}</Button><Button variant="ghost" size="sm" disabled={pending.size > 0} onClick={() => void favorite(Array.from(selected), false)}>{tx('Quitar favoritos', 'Remove favorites')}</Button><Button variant="secondary" size="sm" onClick={() => { setExportFields(config.columns); setExportOpen(true); }}><Download className="w-3.5 h-3.5" />{tx('Exportar', 'Export')}</Button>{entity === 'people' && (
  <PersonBulkStatusSelect
    disabled={pending.size > 0}
    saving={pending.size > 0}
    onChange={(value) => void status(Array.from(selected), value)}
  />
)}{onDeleteSelected && <Button variant="ghost" size="sm" onClick={() => void remove()}><Trash2 className="w-3.5 h-3.5" />{tx('Eliminar', 'Delete')}</Button>}<Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{tx('Limpiar selección', 'Clear selection')}</Button></div></div>}
    {data.items.length ? <><CrmTable entity={entity} rows={data.items} config={config} selected={selected} pending={pending} onConfig={change} onSelect={select} onFavorite={(ids, value) => void favorite(ids, value)} onOpen={row => router.push(`/dashboard/applications/${entity}/${row.id}`)} onDelete={row => void remove(row)} renderCell={cell} optionLabel={optionLabel} lookups={lookups} /><CrmPagination total={data.total} page={data.page} pageSize={config.pageSize} itemsCount={data.items.length} onPage={setPage} onPageSize={pageSize => change({ ...config, pageSize })} /></> : <div className="rounded-[12px] border border-subtle bg-surface p-12 text-center text-text"><h2 className="font-display font-bold">{config.filters.favoritesOnly ? tx('Todavía no hay favoritos en esta vista', 'No favorites in this view yet') : tx('No hay resultados', 'No results')}</h2><p className="text-sm text-text-muted mt-2">{config.filters.favoritesOnly ? tx('Marca una estrella en otra vista o revisa los filtros.', 'Mark a star in another view or review the filters.') : tx('Añade un registro o revisa los filtros.', 'Add a record or review the filters.')}</p>{hasAdditionalFilters ? <Button variant="secondary" className="mt-4" onClick={clearAdditionalFilters}>{tx('Limpiar filtros', 'Clear filters')}</Button> : <Button className="mt-4" onClick={onCreate}>{entity === 'companies' ? tx('Nueva empresa', 'New company') : tx('Nueva persona', 'New person')}</Button>}</div>}
    {exportOpen && <CrmDialog title={tx('Exportar datos', 'Export data')} onClose={() => { if (!exportBusy) setExportOpen(false); }}><p className="text-sm text-text-muted mb-4">{selected.size > 1000 ? tx('El límite de exportación es de 1.000 filas. Reduce la selección.', 'The export limit is 1,000 rows. Reduce your selection.') : tx(`${selected.size} filas seleccionadas`, `${selected.size} selected rows`)}</p><div className="flex gap-3 mb-4"><button type="button" className="text-xs underline text-text" onClick={() => setExportFields(defs.map(d => d.id))}>{tx('Todos los campos', 'All fields')}</button><button type="button" className="text-xs underline text-text" onClick={() => setExportFields(config.columns)}>{tx('Columnas visibles', 'Visible columns')}</button></div><div className="grid grid-cols-2 gap-3">{[...defs, { id: 'isFavorite', label: ['Favorito', 'Favorite'] }].map(d => <label key={d.id} className="flex gap-2 items-center text-sm text-text"><input type="checkbox" checked={exportFields.includes(d.id)} onChange={e => setExportFields(prev => e.target.checked ? [...prev, d.id] : prev.filter(k => k !== d.id))} />{d.label[en ? 1 : 0]}</label>)}</div><div className="flex flex-wrap gap-3 mt-6"><Button variant="secondary" disabled={!exportFields.length || selected.size > 1000} loading={exportBusy} onClick={() => void exportRows(false)}>{tx('Descargar CSV', 'Download CSV')}</Button><Button variant="secondary" disabled={!exportFields.length || selected.size > 1000 || exportBusy} onClick={() => void exportRows(true)}>{tx('Copiar para Excel / Sheets', 'Copy for Excel / Sheets')}</Button></div></CrmDialog>}
    {children}
  </div>;
}
