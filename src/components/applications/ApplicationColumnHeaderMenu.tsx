"use client";
import CrmColumnHeaderMenu, { type CrmColumnHeaderMenuProps } from '@/components/crm/CrmColumnHeaderMenu';
import { APPLICATION_COLUMN_IDS, APPLICATION_STATUSES, type ApplicationColumnFilter, type ApplicationColumnId, type ApplicationSortKey, type ApplicationGrouping } from '@/lib/application-views';
import { type CrmColumn } from '@/lib/crm-views';
import { useLanguage } from '@/lib/i18n/LanguageContext';
type Props = Omit<CrmColumnHeaderMenuProps, 'columnDefinitions' | 'onSetSort' | 'onSetGrouping' | 'onSetColumnFilter'> & {
  onSetSort: (key: ApplicationSortKey, direction: 'asc' | 'desc') => void;
  onSetGrouping: (grouping: ApplicationGrouping | null) => void;
  onSetColumnFilter: (filter: ApplicationColumnFilter | null) => void;
};
export default function ApplicationColumnHeaderMenu(props: Props) {
  const { t } = useLanguage();
  const defs: CrmColumn[] = APPLICATION_COLUMN_IDS.map(id => ({ id, label: [t(`applications.columns.labels.${id}`), t(`applications.columns.labels.${id}`)], kind: ['createdAt', 'updatedAt', 'followup'].includes(id) ? 'date' : id === 'company' ? 'relation' : id === 'status' ? 'choice' : id === 'cv' ? 'presence' : id === 'score' ? 'number' : 'text', options: id === 'status' ? APPLICATION_STATUSES : undefined }));
  return <CrmColumnHeaderMenu {...props} columnDefinitions={defs} onSetSort={(key, direction) => props.onSetSort(key as ApplicationSortKey, direction)} onSetGrouping={group => props.onSetGrouping(group as ApplicationGrouping | null)} onSetColumnFilter={filter => props.onSetColumnFilter(filter as ApplicationColumnFilter | null)} />;
}
