'use client';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { deletePersonAction } from '@/app/dashboard/applications/people/actions';
import CrmWorkspace, { type CrmWorkspaceProps } from '@/components/crm/CrmWorkspace';
import { CrmDialog } from '@/components/crm/CrmControls';
import { type CrmRow } from '@/lib/crm-views';
import PersonAvatar from './PersonAvatar';
import CompanyIcon from '@/components/companies/CompanyIcon';
import PersonForm from './PersonForm';
import { kindLabel, errorLabel } from './ui';

export default function PeopleClient({ creating = false, links, ...props }: Omit<CrmWorkspaceProps, 'entity' | 'onCreate' | 'onDelete' | 'renderCell'> & { creating?: boolean; links?: { companyId?: string; offerId?: string } }) {
  const [open, setOpen] = useState(creating), [busy, setBusy] = useState(false), { language } = useLanguage(), en = language === 'en';
  function renderCell(row: CrmRow, key: string) {
    if (key === 'name') return <span className="flex items-center gap-2 font-display font-bold text-text"><PersonAvatar id={row.id} name={row.name} hash={row.avatarHash as string | null} /><span className="truncate max-w-[300px]" title={row.name}>{row.name}</span></span>;
    if (key === 'companyNames') return <span className="inline-flex flex-wrap gap-x-2 gap-y-1">{row.companies?.length ? row.companies.map(c => <Link key={c.id} href={`/dashboard/applications/companies/${c.id}`} onClick={e => e.stopPropagation()} className="inline-flex items-center gap-2 text-ai hover:underline"><CompanyIcon companyId={c.id} iconHash={c.iconHash} name={c.name} />{c.name}</Link>) : <span className="text-text-muted">—</span>}</span>;
    if (['createdAt', 'updatedAt', 'lastContactAt', 'nextFollowupAt'].includes(key)) return row[key] ? <span className="text-text-muted whitespace-nowrap" title={new Date(row[key] as string).toLocaleString(en ? 'en-GB' : 'es-ES')}>{new Date(row[key] as string).toLocaleDateString(en ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span> : <span className="text-text-muted">—</span>;
    if (key === 'kind') return <span className="text-text-muted">{kindLabel(String(row.kind), en)}</span>;
    if (key === 'linkedinUrl') return row.linkedinUrl ? <a href={String(row.linkedinUrl)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-ai inline-flex gap-1 items-center hover:underline"><ExternalLink className="w-3.5 h-3.5" />LinkedIn</a> : <span className="text-text-muted">—</span>;
    return <span className="text-text-muted">{String(row[key] || '—')}</span>;
  }
  return <CrmWorkspace {...props} entity="people" renderCell={renderCell} onCreate={() => setOpen(true)} onDelete={async row => { const result = await deletePersonAction(row.id); if (result.error) return errorLabel(result.error, en); }}>
    {open && <CrmDialog title={en ? 'New person' : 'Nueva persona'} onClose={() => { if (!busy) setOpen(false); }}><PersonForm link={links} onCancel={() => setOpen(false)} onBusyChange={setBusy} /></CrmDialog>}
  </CrmWorkspace>;
}
