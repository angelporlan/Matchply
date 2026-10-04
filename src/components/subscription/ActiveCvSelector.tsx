'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { reportPlanRestriction } from '@/lib/plan-presentation';
import { Button } from '@/components/ui/Button';
import { usePlanUsage } from './PlanUsageProvider';
import { PlanDialog } from './PlanDialog';

export function ActiveCvSelector({ cvs }: { cvs?: Array<{ id: string; title: string; isBase: boolean }> }) {
  const { data, refresh } = usePlanUsage();
  const { t } = useLanguage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [baseCvId, setBaseCvId] = useState<string | null>(null);
  const [adaptedCvIds, setAdaptedCvIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  if (!data || data.cv.readOnlyIds.length === 0) return null;
  const choices = cvs || data.cv.cvs || [];
  const maxAdapted = data.limits.maxAdaptedCvs;
  const maxTotal = data.limits.maxCvs;
  const canAdd = (maxAdapted === null || adaptedCvIds.length < maxAdapted) && (maxTotal === null || adaptedCvIds.length + (baseCvId ? 1 : 0) < maxTotal);
  const selectedTotal = adaptedCvIds.length + (baseCvId ? 1 : 0);
  const validSelection = (maxTotal === null || selectedTotal <= maxTotal) && (maxAdapted === null || adaptedCvIds.length <= maxAdapted);
  async function save() {
    if (pending || !validSelection) return;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/usage/cvs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseCvId, adaptedCvIds }) });
      const value = await response.json();
      if (!response.ok) { reportPlanRestriction(value, 'active-cvs'); throw new Error('CV_SELECTION_FAILED'); }
      await refresh(); router.refresh(); setOpen(false);
    } catch { setError(t('plans.selectionError')); }
    finally { setPending(false); }
  }
  return <div className="my-4 rounded-[12px] border border-warning-text/20 bg-warning-surface p-4">
    <p className="text-sm text-warning-text">{t('plans.readOnlyBody')}</p>
    <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => { setBaseCvId(data.cv.baseCvId || null); setAdaptedCvIds(choices.filter(cv => !cv.isBase && data.cv.activeIds.includes(cv.id)).map(cv => cv.id)); setError(''); setOpen(true); }}>{t('plans.chooseActive')}</Button>
    <PlanDialog open={open} title={t('plans.chooseActive')} onClose={() => { if (!pending) setOpen(false); }}>
      <form onSubmit={event => { event.preventDefault(); void save(); }} className="mt-4 space-y-4">
        <p className="text-sm leading-6 text-text-muted">{t('plans.activeHelp')} {t('plans.cvs')}: {selectedTotal} / {maxTotal === null ? t('plans.unlimited') : maxTotal}</p>
        <fieldset disabled={pending} className="space-y-4"><label className="block text-sm font-medium">{t('plans.base')}<select className="mt-1 min-h-11 w-full rounded-[8px] border border-control bg-canvas px-3 text-base" value={baseCvId || ''} onChange={event => setBaseCvId(event.target.value || null)} disabled={data.limits.maxBaseCvs === 0}><option value="">{t('plans.none')}</option>{choices.filter(cv => cv.isBase).map(cv => <option key={cv.id} value={cv.id}>{cv.title}</option>)}</select></label>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">{t('plans.adapted')} · {adaptedCvIds.length} / {maxAdapted === null ? t('plans.unlimited') : maxAdapted}</legend>{choices.filter(cv => !cv.isBase).map(cv => <label key={cv.id} className="flex gap-3 items-start rounded-[8px] border border-subtle p-3 text-sm"><input type="checkbox" checked={adaptedCvIds.includes(cv.id)} disabled={!adaptedCvIds.includes(cv.id) && !canAdd} className="mt-1" onChange={event => setAdaptedCvIds(previous => event.target.checked ? [...previous, cv.id] : previous.filter(id => id !== cv.id))} /><span>{cv.title}</span></label>)}</fieldset>
        </fieldset>
        {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>{t('plans.cancel')}</Button><Button type="submit" variant="strong" loading={pending} disabled={!validSelection}>{t('plans.save')}</Button></div>
      </form>
    </PlanDialog>
  </div>;
}
