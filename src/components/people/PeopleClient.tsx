'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import type { PeopleList } from '@/lib/people/service';
import { PERSON_STATUSES } from '@/lib/people/types';
import PersonForm from './PersonForm';
import PersonAvatar from './PersonAvatar';
import { control, Field, panel, statusLabel, usePeopleText } from './ui';

export default function PeopleClient({ data, filters, companies }: { data: PeopleList; filters: { q?: string; companyId?: string; offerId?: string; status?: string; due?: string; new?: string }; companies: Array<{ id: string; name: string }> }) {
  const tx = usePeopleText(), en = tx('es', 'en') === 'en', [creating, setCreating] = useState(filters.new === '1');
  const date = (d: Date | string | null) => d ? new Date(d).toLocaleDateString(en ? 'en-GB' : 'es-ES') : '—';
  const pageUrl = (p: number) => { const params = new URLSearchParams(); Object.entries(filters).forEach(([k, v]) => { if (v && k !== 'new') params.set(k, v); }); params.set('page', String(p)); return `?${params}`; };
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-3xl font-bold text-text">{tx('Personas', 'People')}</h1><p className="text-sm text-text-muted mt-2">{tx('Tu red profesional, sus conversaciones y el siguiente paso.', 'Your professional network, conversations and next steps.')}</p></div><Button onClick={() => setCreating(v => !v)} aria-expanded={creating}><Plus className="h-4 w-4" />{tx('Nueva persona', 'New person')}</Button></header>
    {creating && <section className={panel} aria-label={tx('Nueva persona', 'New person')}><h2 className="text-lg font-display font-semibold text-text mb-4">{tx('Crear persona', 'Create person')}</h2><PersonForm link={{ companyId: filters.companyId, offerId: filters.offerId }} onCancel={() => setCreating(false)} /></section>}
    <form className={`${panel} grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end`} method="get">
      <Field label={tx('Buscar nombre o cargo', 'Search name or role')}><input className={control} name="q" defaultValue={filters.q} maxLength={180} /></Field>
      <Field label={tx('Empresa', 'Company')}><select className={control} name="companyId" defaultValue={filters.companyId || ''}><option value="">{tx('Todas', 'All')}</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label={tx('Estado', 'Status')}><select name="status" className={control} defaultValue={filters.status || ''}><option value="">{tx('Todos', 'All')}</option>{PERSON_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s, en)}</option>)}</select></Field>
      {filters.offerId && <input type="hidden" name="offerId" value={filters.offerId} />}
      <label className="flex items-center gap-2 text-sm text-text py-2"><input type="checkbox" name="due" value="1" defaultChecked={filters.due === '1'} />{tx('Seguimientos pendientes', 'Follow-ups due')}</label>
      <div className="flex gap-2"><Button variant="secondary" size="sm" type="submit">{tx('Filtrar', 'Filter')}</Button><ButtonLink href="/dashboard/applications/people" variant="ghost" size="sm">{tx('Limpiar', 'Clear')}</ButtonLink></div>
    </form>
    <p className="text-sm text-text-muted">{data.total} {tx('personas', 'people')}{filters.offerId && <> · <Link className="underline" href={`/dashboard/applications/offer/${filters.offerId}`}>{tx('Ver oferta vinculada', 'View linked offer')}</Link></>}</p>
    {!data.items.length ? <div className={`${panel} text-center py-14`}><Users className="mx-auto h-8 w-8 text-text-muted" /><h2 className="font-display text-lg font-semibold text-text mt-4">{tx('Empieza por una conversación', 'Start with a conversation')}</h2><p className="text-sm text-text-muted mt-2">{tx('Añade una persona o cambia los filtros para encontrar tus contactos.', 'Add someone or change the filters to find your contacts.')}</p></div> : <>
      <div className="hidden md:block overflow-x-auto rounded-[12px] border border-subtle bg-surface"><table className="w-full text-sm text-left"><thead className="bg-surface-muted text-text-muted"><tr>{[tx('Persona', 'Person'), tx('Empresas', 'Companies'), tx('Estado', 'Status'), tx('Último contacto', 'Last contact'), tx('Seguimiento', 'Follow-up')].map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-subtle">{data.items.map(p => <tr key={p.id} className="text-text hover:bg-surface-muted/50"><td className="p-4"><Link href={`/dashboard/applications/people/${p.id}`} className="flex items-center gap-3 font-semibold"><PersonAvatar id={p.id} name={p.name} hash={p.avatarHash} /><span>{p.name}<span className="block font-normal text-text-muted">{p.role || p.headline || '—'}</span></span></Link></td><td className="p-4">{Array.from(new Set(p.companies.map(c => c.name))).join(', ') || '—'}</td><td className="p-4">{statusLabel(p.status, en)}</td><td className="p-4 whitespace-nowrap">{date(p.lastContactAt)}</td><td className="p-4 whitespace-nowrap">{date(p.nextFollowupAt)}</td></tr>)}</tbody></table></div>
      <div className="md:hidden grid gap-3">{data.items.map(p => <Link key={p.id} href={`/dashboard/applications/people/${p.id}`} className={panel}><div className="flex items-center gap-3"><PersonAvatar id={p.id} name={p.name} hash={p.avatarHash} size="md" /><div className="min-w-0"><h2 className="font-semibold text-text">{p.name}</h2><p className="text-sm text-text-muted break-words">{p.role || p.headline}</p></div></div><p className="text-sm text-text-muted mt-3">{Array.from(new Set(p.companies.map(c => c.name))).join(', ') || '—'}</p><p className="text-sm text-text mt-2">{statusLabel(p.status, en)}</p><dl className="grid grid-cols-2 text-xs text-text-muted mt-3 gap-2"><div><dt>{tx('Último contacto', 'Last contact')}</dt><dd>{date(p.lastContactAt)}</dd></div><div><dt>{tx('Seguimiento', 'Follow-up')}</dt><dd>{date(p.nextFollowupAt)}</dd></div></dl></Link>)}</div>
    </>}
    <nav className="flex items-center justify-between gap-3" aria-label={tx('Paginación de personas', 'People pagination')}><span className="text-sm text-text-muted">{tx('Página', 'Page')} {data.page} / {Math.max(1, Math.ceil(data.total / 25))}</span><div className="flex gap-2">{data.page > 1 && <ButtonLink variant="secondary" size="sm" href={pageUrl(data.page - 1)}>{tx('Anterior', 'Previous')}</ButtonLink>}{data.page * 25 < data.total && <ButtonLink variant="secondary" size="sm" href={pageUrl(data.page + 1)}>{tx('Siguiente', 'Next')}</ButtonLink>}</div></nav>
  </div>;
}
