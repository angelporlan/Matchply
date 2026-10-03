'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { createCompanyAction, deleteCompanyAction, deleteCompaniesAction } from '@/app/dashboard/applications/companies/actions';
import { Button } from '@/components/ui/Button';
import CompanyIcon from './CompanyIcon';
import CrmWorkspace, { type CrmWorkspaceProps } from '@/components/crm/CrmWorkspace';
import { CrmDialog } from '@/components/crm/CrmControls';
import { crmColumns, type CrmRow } from '@/lib/crm-views';

export default function CompaniesClient(props: Omit<CrmWorkspaceProps, 'entity' | 'onCreate' | 'onDelete' | 'renderCell'>) {
  const { t, language } = useLanguage(), router = useRouter(), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [values, setValues] = useState({ name: '', website: '', location: '', sector: '' }), en = language === 'en';
  const errorText = (code: string, count?: number) => code === 'COMPANY_HAS_APPLICATIONS' ? (en ? `This company has ${count} applications and was kept.` : `Esta empresa tiene ${count} postulaciones y se ha conservado.`) : t(`companies.errors.${code}`) === `companies.errors.${code}` ? t('companies.errors.generic') : t(`companies.errors.${code}`);
  const renderCell = (row: CrmRow, key: string) => {
    if (key === 'name') return <span className="flex items-center gap-2 font-display font-bold text-text"><CompanyIcon companyId={row.id} iconHash={row.iconHash as string | null} name={row.name} /><span className="truncate max-w-[300px]" title={row.name}>{row.name}</span></span>;
    if (key === 'website') return row.website ? <a href={String(row.website)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-ai hover:underline"><ExternalLink className="w-3.5 h-3.5" />{en ? 'Open website' : 'Abrir web'}</a> : <span className="text-text-muted">—</span>;
    if (key === 'applicationCount' || key === 'noteCount') return <span className="inline-flex items-center justify-center min-w-6 rounded-full border border-subtle bg-surface-muted px-1.5 py-0.5 font-semibold text-text">{String(row[key])}</span>;
    if (key === 'createdAt' || key === 'updatedAt') return <span className="text-text-muted whitespace-nowrap" title={new Date(row[key] as string).toLocaleString(en ? 'en-GB' : 'es-ES')}>{new Date(row[key] as string).toLocaleDateString(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>;
    return <span className="text-text-muted">{String(row[key] || '—')}</span>;
  };
  return <CrmWorkspace {...props} entity="companies" renderCell={renderCell} onCreate={() => setOpen(true)} onDelete={async row => { const result = await deleteCompanyAction(row.id); if ('error' in result) return errorText(result.error!, result.applicationCount); }} onDeleteSelected={async ids => { const result = await deleteCompaniesAction(ids); if ('error' in result) return errorText(result.error!); return en ? `${result.deletedCount} removed; ${result.skippedCount} kept because they have applications.` : `${result.deletedCount} eliminadas; ${result.skippedCount} conservadas porque tienen postulaciones.`; }}>
    {open && <CrmDialog title={en ? 'New company' : 'Nueva empresa'} onClose={() => { if (!busy) setOpen(false); }}><form className="space-y-4" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { const result = await createCompanyAction(values); if ('error' in result) setError(errorText(result.error!)); else { setOpen(false); setValues({ name: '', website: '', location: '', sector: '' }); router.refresh(); } } catch { setError(t('companies.errors.generic')); } finally { setBusy(false); } }}>
      {(['name', 'website', 'location', 'sector'] as const).map(key => <label key={key} className="block text-sm text-text-muted">{crmColumns('companies').find(c => c.id === key)!.label[en ? 1 : 0]}{key === 'name' ? ' *' : ''}<input required={key === 'name'} type={key === 'website' ? 'url' : 'text'} maxLength={key === 'website' ? 2000 : 240} value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} className="mt-1.5 w-full rounded-[8px] border border-control bg-surface px-3 py-2.5 text-text focus-visible:ring-2 focus-visible:ring-ai" /></label>)}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}<div className="flex gap-3"><Button type="submit" loading={busy}>{en ? 'Create company' : 'Crear empresa'}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{en ? 'Cancel' : 'Cancelar'}</Button></div>
    </form></CrmDialog>}
  </CrmWorkspace>;
}
