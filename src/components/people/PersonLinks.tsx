'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { linkPersonAction, searchPersonLinksAction, unlinkPersonAction } from '@/app/dashboard/applications/people/actions';
import type { personLinks } from '@/lib/people/service';
import { COMPANY_RELATIONS } from '@/lib/people/types';
import { control, Field, panel, relationLabel, errorLabel, usePeopleText } from './ui';

type Options = { companies: Array<{ id: string; name: string }>; offers: Array<{ id: string; title: string; company: string }> };
export default function PersonLinks({ personId, links }: { personId: string; links: Awaited<ReturnType<typeof personLinks>> }) {
  const tx = usePeopleText(), en = tx('es', 'en') === 'en', router = useRouter();
  const [options, setOptions] = useState<Options>({ companies: [], offers: [] }), [query, setQuery] = useState(''), [companyId, setCompany] = useState(''), [companyName, setName] = useState(''), [offerId, setOffer] = useState(''), [relation, setRelation] = useState('unconfirmed'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => { let active = true; const timer = setTimeout(() => { void searchPersonLinksAction(query).then(r => { if (active && r.data) setOptions(r.data); }).catch(() => { if (active) setError('PEOPLE_ACTION_FAILED'); }); }, 250); return () => { active = false; clearTimeout(timer); }; }, [query]);
  async function mutate(fn: () => Promise<{ error?: string }>) { setBusy(true); setError(''); try { const r = await fn(); if (r.error) setError(r.error); else router.refresh(); } catch { setError('PEOPLE_ACTION_FAILED'); } finally { setBusy(false); } }
  return <section className={`${panel} space-y-4`}><h2 className="font-display text-lg font-semibold text-text">{tx('Empresas y ofertas vinculadas', 'Linked companies and offers')}</h2>
    <ul className="space-y-2 text-sm text-text">{links.companies.map(c => <li key={`${c.companyId}:${c.relation}`} className="flex flex-wrap gap-2 items-center justify-between"><span>{relationLabel(c.relation, en)}: <Link className="underline" href={`/dashboard/applications/companies/${c.companyId}`}>{c.name}</Link></span><Button variant="ghost" size="sm" disabled={busy} onClick={() => mutate(() => unlinkPersonAction(personId, { companyId: c.companyId, relation: c.relation }))} aria-label={`${tx('Desvincular', 'Unlink')} ${c.name}`}>{tx('Desvincular', 'Unlink')}</Button></li>)}{links.offers.map(o => <li key={o.offerId} className="flex flex-wrap gap-2 items-center justify-between"><Link className="underline" href={`/dashboard/applications/offer/${o.offerId}`}>{o.title} · {o.company}</Link><Button variant="ghost" size="sm" disabled={busy} onClick={() => mutate(() => unlinkPersonAction(personId, { offerId: o.offerId }))} aria-label={`${tx('Desvincular', 'Unlink')} ${o.title}`}>{tx('Desvincular', 'Unlink')}</Button></li>)}</ul>
    <Field label={tx('Buscar empresas y ofertas (hasta 50 resultados)', 'Search companies and offers (up to 50 results)')}><input className={control} value={query} onChange={e => setQuery(e.target.value)} maxLength={180} /></Field>
    <form className="grid sm:grid-cols-2 gap-3 items-end" onSubmit={e => { e.preventDefault(); void mutate(() => linkPersonAction(personId, { companyId: companyId || undefined, companyName: !companyId ? companyName : undefined, relation })); }}>
      <Field label={tx('Empresa existente', 'Existing company')}><select className={control} value={companyId} onChange={e => setCompany(e.target.value)}><option value="">{tx('Seleccionar o crear', 'Select or create')}</option>{options.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label={tx('Tipo de relación', 'Relationship type')}><select className={control} value={relation} onChange={e => setRelation(e.target.value)}>{COMPANY_RELATIONS.map(r => <option key={r} value={r}>{relationLabel(r, en)}</option>)}</select></Field>
      {!companyId && <Field label={tx('Nombre de nueva empresa', 'New company name')}><input className={control} value={companyName} maxLength={120} onChange={e => setName(e.target.value)} /></Field>}
      <Button variant="secondary" type="submit" disabled={busy || (!companyId && !companyName.trim())}>{tx('Vincular empresa', 'Link company')}</Button>
    </form>
    <form className="flex flex-wrap gap-3 items-end" onSubmit={e => { e.preventDefault(); void mutate(() => linkPersonAction(personId, { offerId })); }}><div className="flex-1 min-w-[180px]"><Field label={tx('Oferta existente', 'Existing offer')}><select className={control} value={offerId} onChange={e => setOffer(e.target.value)}><option value="">{tx('Selecciona una oferta', 'Select an offer')}</option>{options.offers.map(o => <option key={o.id} value={o.id}>{o.title} · {o.company}</option>)}</select></Field></div><Button variant="secondary" type="submit" disabled={busy || !offerId}>{tx('Vincular oferta', 'Link offer')}</Button></form>
    {error && <p role="alert" className="text-sm text-danger">{errorLabel(error, en)}</p>}
  </section>;
}
