'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Star, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { CRM_PAGE_SIZES } from '@/lib/crm-views';
import { ModalScrim } from '@/components/ui/ModalScrim';

export function FavoriteButton({ favorite, busy, name, onChange }: { favorite: boolean; busy?: boolean; name: string; onChange: () => void }) {
  const { language } = useLanguage();
  const label = language === 'es' ? `${favorite ? 'Quitar de' : 'Añadir a'} favoritos: ${name}` : `${favorite ? 'Remove from' : 'Add to'} favorites: ${name}`;
  return <button type="button" aria-label={label} title={label} aria-pressed={favorite} disabled={busy} onClick={e => { e.stopPropagation(); onChange(); }} className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-[8px] hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ai disabled:opacity-40 ${favorite ? 'text-ai' : 'text-text-muted'}`}><Star className="h-4 w-4 stroke-[1.75]" fill={favorite ? 'currentColor' : 'none'} /></button>;
}
export function SelectionCheckbox({ checked, indeterminate = false, onChange, label, onClick }: { checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void; label: string; onClick?: (e: React.MouseEvent) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} onClick={onClick} aria-label={label} className="h-3.5 w-3.5 rounded border-control accent-ai cursor-pointer" />;
}
export function CrmPagination({ total, page, pageSize, itemsCount, onPage, onPageSize }: { total: number; page: number; pageSize: number; itemsCount: number; onPage: (page: number) => void; onPageSize: (size: number) => void }) {
  const { t } = useLanguage(), totalPages = Math.max(1, Math.ceil(total / pageSize)), start = (page - 1) * pageSize;
  return <div className="sticky bottom-0 z-20 mt-3 bg-canvas pb-4 md:static md:mt-0 md:shrink-0"><div className="rounded-[12px] border border-subtle bg-surface px-4 py-3 shadow-sm md:rounded-t-none flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-display">
    <p className="text-xs text-text-muted">{t('applications.table.pagination.showing', { start: total ? start + 1 : 0, end: Math.min(start + itemsCount, total), total })}</p>
    <div className="flex items-center gap-2"><select aria-label={t('applications.table.pagination.perPage')} value={pageSize} onChange={e => onPageSize(Number(e.target.value))} className="bg-surface border border-subtle rounded-[8px] px-2.5 py-2 text-xs font-semibold text-text-muted focus-visible:ring-2 focus-visible:ring-ai cursor-pointer font-sans">{CRM_PAGE_SIZES.map(size => <option key={size} value={size}>{size} {t('applications.table.pagination.perPageSuffix')}</option>)}</select>
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label={t('applications.table.pagination.previous')} className="p-2 rounded-[8px] border border-subtle bg-surface text-text-muted disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
      <span className="text-xs font-semibold text-text-muted">{t('applications.table.pagination.page', { page, total: totalPages })}</span>
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label={t('applications.table.pagination.next')} className="p-2 rounded-[8px] border border-subtle bg-surface text-text-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
    </div>
  </div></div>;
}
export function CrmDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null), { language } = useLanguage();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus(), 0);
    return () => { clearTimeout(timer); previous?.focus(); };
  }, []);
  return <ModalScrim onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-surface border border-subtle rounded-[16px] p-6 shadow-dialog" onKeyDown={e => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]') || []);
    if (!nodes.length) return;
    if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes[nodes.length - 1].focus(); }
    if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) { e.preventDefault(); nodes[0].focus(); }
  }}><div className="flex items-center justify-between gap-3 mb-6"><h2 className="font-display text-lg font-bold text-text">{title}</h2><button type="button" onClick={onClose} aria-label={language === 'es' ? 'Cerrar' : 'Close'} className="p-3 text-text-muted rounded-[8px] hover:bg-surface-muted"><X className="w-4 h-4" /></button></div>{children}</div></ModalScrim>;
}
