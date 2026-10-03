'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { savePersonAction } from '@/app/dashboard/applications/people/actions';
import { PERSON_KINDS, PERSON_STATUSES, type PersonInput } from '@/lib/people/types';
import { control, Field, errorLabel, kindLabel, statusLabel, usePeopleText } from './ui';

type FormPerson = PersonInput & { id?: string; nextFollowupAt?: string | null };
export default function PersonForm({ person, link, onCancel, onBusyChange }: { person?: FormPerson; link?: { companyId?: string; offerId?: string }; onCancel?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const tx = usePeopleText(), router = useRouter(), en = tx('es', 'en') === 'en';
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [values, setValues] = useState<PersonInput>(person || { name: '', kind: 'other', status: 'pending', language: en ? 'en' : 'es', tone: 'professional' });
  const set = (key: keyof PersonInput, value: string) => setValues(v => ({ ...v, [key]: value }));
  const input = (key: keyof PersonInput, es: string, english: string, max: number, type = 'text', required = false) => <Field key={key} label={tx(es, english)}><input className={control} type={type} required={required} maxLength={max} value={values[key] || ''} onChange={e => set(key, e.target.value)} /></Field>;
  const area = (key: keyof PersonInput, es: string, english: string, max: number) => <Field key={key} label={tx(es, english)}><textarea className={control} rows={3} maxLength={max} value={values[key] || ''} onChange={e => set(key, e.target.value)} /></Field>;
  return <form className="space-y-6" onSubmit={async e => { e.preventDefault(); setBusy(true); onBusyChange?.(true); setError(''); try { const result = await savePersonAction(values, person?.id, link); if (result.error) setError(result.error); else if (result.data) { router.push(`/dashboard/applications/people/${result.data.id}`); router.refresh(); } } catch { setError('PEOPLE_ACTION_FAILED'); } finally { setBusy(false); onBusyChange?.(false); } }}>
    <div className="grid sm:grid-cols-2 gap-4">
      {input('name', 'Nombre *', 'Name *', 180, 'text', true)}{input('role', 'Cargo', 'Role', 240)}
      <Field label={tx('Tipo de contacto', 'Contact type')}><select className={control} value={values.kind || 'other'} onChange={e => set('kind', e.target.value)}>{PERSON_KINDS.map(k => <option key={k} value={k}>{kindLabel(k, en)}</option>)}</select></Field>
      <Field label={tx('Estado de relación', 'Relationship status')}><select className={control} value={values.status || 'pending'} onChange={e => set('status', e.target.value)}>{PERSON_STATUSES.map(k => <option key={k} value={k}>{statusLabel(k, en)}</option>)}</select></Field>
      {input('linkedinUrl', 'Perfil de LinkedIn', 'LinkedIn profile', 2000, 'url')}{input('email', 'Email profesional', 'Professional email', 254, 'email')}
      {input('headline', 'Titular profesional', 'Professional headline', 1000)}{input('location', 'Ubicación', 'Location', 240)}
      {input('origin', 'Cómo lo conociste', 'How you met', 1000)}{input('connectionDegree', 'Grado de conexión', 'Connection degree', 80)}
    </div>
    <div className="grid sm:grid-cols-2 gap-4">{area('objective', 'Objetivo del contacto', 'Contact goal', 4000)}{area('topics', 'Temas profesionales relevantes', 'Relevant professional topics', 4000)}</div>
    {area('notes', 'Notas privadas', 'Private notes', 12000)}
    <div className="grid sm:grid-cols-2 gap-4">{input('nextAction', 'Próxima acción', 'Next action', 1000)}{input('nextFollowupAt', 'Fecha de seguimiento', 'Follow-up date', 10, 'date')}
      <Field label={tx('Idioma de los borradores', 'Draft language')}><select className={control} value={values.language || 'es'} onChange={e => set('language', e.target.value)}><option value="es">Español</option><option value="en">English</option></select></Field>
      <Field label={tx('Tono preferido', 'Preferred tone')}><select className={control} value={values.tone || 'professional'} onChange={e => set('tone', e.target.value)}>{[['professional', 'Profesional', 'Professional'], ['friendly', 'Cercano', 'Friendly'], ['direct', 'Directo', 'Direct'], ['formal', 'Formal', 'Formal']].map(([k, es, english]) => <option key={k} value={k}>{tx(es, english)}</option>)}</select></Field>
    </div>
    {error && <p role="alert" className="text-sm text-danger">{errorLabel(error, en)}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" variant={person ? 'strong' : 'primary'} loading={busy}>{person ? tx('Guardar perfil', 'Save profile') : tx('Crear persona', 'Create person')}</Button>{onCancel && <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>{tx('Cancelar', 'Cancel')}</Button>}</div>
  </form>;
}
