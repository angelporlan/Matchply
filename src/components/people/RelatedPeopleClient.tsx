'use client';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { panel, usePeopleText } from './ui';
export default function RelatedPeopleClient({ people, total, companyId, offerId }: { people: Array<{ id: string; name: string; role: string | null }>; total: number; companyId?: string; offerId?: string }) {
  const tx = usePeopleText(), params = new URLSearchParams(); if (companyId) params.set('companyId', companyId); if (offerId) params.set('offerId', offerId);
  const href = `/dashboard/applications/people?${params}`;
  return <section className={`${panel} mt-6 space-y-4`}><div className="flex flex-wrap justify-between items-center gap-3"><h2 className="font-display text-lg font-semibold text-text">{tx('Tus personas vinculadas', 'Your linked people')} ({total})</h2><ButtonLink href={`${href}&new=1`} size="sm">{tx('Añadir persona', 'Add person')}</ButtonLink></div>{people.length ? <ul className="space-y-2">{people.map(p => <li key={p.id}><Link href={`/dashboard/applications/people/${p.id}`} className="text-sm text-text underline">{p.name}</Link>{p.role && <p className="text-xs text-text-muted">{p.role}</p>}</li>)}</ul> : <p className="text-sm text-text-muted">{tx('Vincula contactos para preparar tu próximo acercamiento.', 'Link contacts to prepare your next approach.')}</p>}<Link className="text-sm text-text-muted underline" href={href}>{tx('Ver todas las personas', 'View all people')}</Link></section>;
}
