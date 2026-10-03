'use client';
import { Fragment, useState, type ReactNode } from 'react';
import { ChevronRight, Eye, Trash2, Star } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { crmColumns, CRM_WIDTH_PX, type CrmConfig, type CrmRow, type ListEntity } from '@/lib/crm-views';
import CrmColumnHeaderMenu from './CrmColumnHeaderMenu';
import { FavoriteButton, SelectionCheckbox } from './CrmControls';

export default function CrmTable({ entity, rows, config, selected, pending, onConfig, onSelect, onFavorite, onOpen, onDelete, renderCell, optionLabel, lookups }: {
  entity: ListEntity; rows: CrmRow[]; config: CrmConfig; selected: Set<string>; pending: Set<string>;
  onConfig: (config: CrmConfig) => void; onSelect: (ids: string[], checked: boolean) => void; onFavorite: (ids: string[], value: boolean) => void;
  onOpen: (row: CrmRow) => void; onDelete: (row: CrmRow) => void; renderCell: (row: CrmRow, column: string) => ReactNode;
  optionLabel: (value: string) => string; lookups: { id: string; name: string }[];
}) {
  const { t, language } = useLanguage(), defs = crmColumns(entity), [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const label = (key: string) => key === 'actions' ? t('applications.columns.labels.actions') : defs.find(c => c.id === key)?.label[language === 'en' ? 1 : 0] || key;
  const items = [...config.columns], actionsIndex = config.actionsIndex ?? items.length; items.splice(actionsIndex, 0, 'actions');
  const style = (key: string) => { const width = CRM_WIDTH_PX[config.columnWidths[key] || 'auto']; return width ? { width, minWidth: width, maxWidth: width } : undefined; };
  const move = (key: string, direction: -1 | 1) => {
    if (key === 'actions') { onConfig({ ...config, actionsIndex: Math.max(0, Math.min(config.columns.length, actionsIndex + direction)) }); return; }
    const cols = [...config.columns], index = cols.indexOf(key), target = index + direction;
    if (target < 0 || target >= cols.length) return;
    [cols[index], cols[target]] = [cols[target], cols[index]]; onConfig({ ...config, columns: cols });
  };
  const actions = (row: CrmRow) => <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><button type="button" onClick={() => onOpen(row)} aria-label={`${language === 'es' ? 'Abrir ficha' : 'Open details'}: ${row.name}`} className="p-2 text-text-muted hover:text-text rounded-[8px]"><Eye className="h-3.5 w-3.5" /></button><button type="button" onClick={() => onDelete(row)} aria-label={`${language === 'es' ? 'Eliminar' : 'Delete'}: ${row.name}`} className="p-2 text-text-muted hover:text-danger rounded-[8px]"><Trash2 className="h-3.5 w-3.5" /></button></div>;
  const row = (r: CrmRow) => <tr key={r.id} onClick={() => onOpen(r)} className={`group cursor-pointer transition-colors ${selected.has(r.id) ? 'bg-ai/5' : 'hover:bg-canvas/70'}`}><td className="px-3 py-2.5" onClick={e => e.stopPropagation()}><SelectionCheckbox checked={selected.has(r.id)} onChange={checked => onSelect([r.id], checked)} label={`${language === 'es' ? 'Seleccionar fila' : 'Select row'}: ${r.name}`} /></td><td className="px-0"><FavoriteButton name={r.name} favorite={r.isFavorite} busy={pending.size > 0} onChange={() => onFavorite([r.id], !r.isFavorite)} /></td>{items.map(key => <td key={key} style={style(key)} className="px-3 py-2.5 align-middle">{key === 'actions' ? actions(r) : renderCell(r, key)}</td>)}</tr>;
  const groups = new Map<string, CrmRow[]>();
  if (config.grouping) {
    for (const r of rows) {
      const key = config.grouping.column, raw = r[key];
      const value = defs.find(c => c.id === key)?.kind === 'date' && raw ? new Date(raw as string).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-GB') : raw == null || raw === '' ? '—' : ['status', 'kind'].includes(key) ? optionLabel(String(raw)) : String(raw);
      groups.set(value, [...(groups.get(value) || []), r]);
    }
  }
  return <>
    <div className="hidden md:block border border-subtle bg-surface shadow-sm overflow-hidden rounded-t-[12px] border-b-0"><div className="overflow-x-auto scrollbar-custom max-h-[calc(100vh-300px)] overflow-y-auto"><table className="min-w-full text-left text-xs font-sans"><caption className="sr-only">{entity === 'companies' ? t('companies.title') : language === 'es' ? 'Personas' : 'People'}</caption><thead className="bg-surface-muted/70 dark:bg-canvas/40 text-[10px] uppercase tracking-wider text-text-muted font-display md:sticky md:top-0 md:z-10 md:bg-surface-muted md:dark:bg-canvas"><tr>
      <th className="w-10 px-3 py-3"><SelectionCheckbox checked={rows.length > 0 && rows.every(r => selected.has(r.id))} indeterminate={rows.some(r => selected.has(r.id)) && !rows.every(r => selected.has(r.id))} onChange={checked => onSelect(rows.map(r => r.id), checked)} label={language === 'es' ? 'Seleccionar esta página' : 'Select this page'} /></th><th className="w-11 px-3 py-3"><Star className="w-3.5 h-3.5" aria-label={language === 'es' ? 'Favoritos' : 'Favorites'} /></th>
      {items.map(key => <th key={key} style={style(key)} scope="col" aria-sort={config.sort.key === key ? config.sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'} className="px-3 py-3 whitespace-nowrap font-bold"><CrmColumnHeaderMenu column={key} columnDefinitions={defs} optionLabel={optionLabel} label={label(key)} sortable={key !== 'actions'} filterable={key !== 'actions'} groupable={key !== 'actions'} sort={config.sort} grouping={config.grouping} columnFilter={config.filters.columnFilters?.find(f => f.column === key)} width={config.columnWidths[key] || 'auto'} canMoveLeft={key === 'actions' ? actionsIndex > 0 : config.columns.indexOf(key) > 0} canMoveRight={key === 'actions' ? actionsIndex < config.columns.length : config.columns.indexOf(key) < config.columns.length - 1} onSetSort={(column, direction) => onConfig({ ...config, sort: { key: column, direction } })} onSetGrouping={grouping => { setCollapsed(new Set()); onConfig({ ...config, grouping }); }} onSetColumnFilter={filter => onConfig({ ...config, filters: { ...config.filters, columnFilters: [...(config.filters.columnFilters || []).filter(f => f.column !== key), ...(filter ? [filter] : [])] } })} onSetWidth={width => onConfig({ ...config, columnWidths: { ...config.columnWidths, [key]: width } })} onMove={direction => move(key, direction)} lookupOptions={key === 'companyNames' ? lookups : undefined} /></th>)}
    </tr></thead><tbody className="divide-y divide-subtle">{config.grouping ? Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b) * (config.grouping!.direction === 'asc' ? 1 : -1)).map(([key, members]) => <Fragment key={key}><tr className="bg-surface-muted/50"><td colSpan={items.length + 2}><button type="button" aria-expanded={!collapsed.has(key)} onClick={() => setCollapsed(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; })} className="flex items-center gap-2 w-full px-4 py-3 text-xs font-semibold text-text"><ChevronRight className={`w-4 h-4 ${collapsed.has(key) ? '' : 'rotate-90'}`} />{key}<span className="text-text-muted">{members.length} {language === 'es' ? 'en esta página' : 'on this page'}</span></button></td></tr>{!collapsed.has(key) && members.map(row)}</Fragment>) : rows.map(row)}</tbody></table></div></div>
    <div className="md:hidden space-y-2.5">{rows.map(r => <div key={r.id} onClick={() => onOpen(r)} className={`rounded-[12px] border p-3.5 bg-surface cursor-pointer ${selected.has(r.id) ? 'border-ai/40 bg-ai/5' : 'border-subtle'}`}><div className="flex items-center gap-2" onClick={e => e.stopPropagation()}><SelectionCheckbox checked={selected.has(r.id)} onChange={checked => onSelect([r.id], checked)} label={`${language === 'es' ? 'Seleccionar fila' : 'Select row'}: ${r.name}`} /><FavoriteButton name={r.name} favorite={r.isFavorite} busy={pending.size > 0} onChange={() => onFavorite([r.id], !r.isFavorite)} /></div><dl className="space-y-2">{config.columns.map(key => <div key={key} className="text-xs"><dt className="text-text-muted mb-1">{label(key)}</dt><dd className="text-text">{renderCell(r, key)}</dd></div>)}</dl>{actions(r)}</div>)}</div>
  </>;
}
