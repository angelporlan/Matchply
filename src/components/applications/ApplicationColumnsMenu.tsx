"use client";
import CrmColumnsMenu from '@/components/crm/CrmColumnsMenu';
import { APPLICATION_COLUMN_IDS, DEFAULT_APPLICATION_COLUMNS, type ApplicationColumnId } from '@/lib/application-views';
import { useLanguage } from '@/lib/i18n/LanguageContext';
export default function ApplicationColumnsMenu({ visibleColumns, onChange }: { visibleColumns: ApplicationColumnId[]; onChange: (columns: ApplicationColumnId[]) => void }) {
  const { t } = useLanguage();
  return <CrmColumnsMenu options={APPLICATION_COLUMN_IDS.map(id => ({ id, label: t(`applications.columns.labels.${id}`) }))} defaults={DEFAULT_APPLICATION_COLUMNS} visibleColumns={visibleColumns} onChange={columns => onChange(columns as ApplicationColumnId[])} />;
}
