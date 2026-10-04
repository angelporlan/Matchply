'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';
import { PlanDialog } from './PlanDialog';

export function CvReplacementDialog({ choices, onReplace, onClose }: {
  choices: Array<{ id: string; title: string }>;
  onReplace: (cvId: string) => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState(choices[0]?.id || '');
  return <PlanDialog open title={t('plans.replaceTitle')} onClose={onClose}>
    <p className="mt-4 text-sm leading-6 text-text-muted">{t('plans.replaceBody')}</p>
    <p className="mt-3 rounded-[8px] bg-warning-surface p-3 text-sm leading-6 text-warning-text">{t('plans.replaceLinked')}</p>
    <label className="mt-4 block text-sm font-medium">{t('plans.replaceChoice')}<select className="mt-1 min-h-11 w-full rounded-[8px] border border-control bg-canvas px-3 text-base" value={selected} onChange={event => setSelected(event.target.value)}>{choices.map(cv => <option key={cv.id} value={cv.id}>{cv.title}</option>)}</select></label>
    <div className="mt-6 flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" onClick={onClose}>{t('plans.cancel')}</Button><Button type="button" variant="danger" disabled={!selected} onClick={() => onReplace(selected)}>{t('plans.replaceConfirm')}</Button></div>
  </PlanDialog>;
}
