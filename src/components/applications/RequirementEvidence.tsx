'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { addRequirementEvidence } from '@/app/dashboard/applications/evidence-actions';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';
import { usePlanUsage } from '@/components/subscription/PlanUsageProvider';

export default function RequirementEvidence({ offerId, requirementId, inputHash }: { offerId: string; requirementId: string; inputHash: string }) {
  const { language } = useLanguage(); const es = language === 'es'; const router = useRouter();
  const { data: usage } = usePlanUsage();
  const [open, setOpen] = useState(false); const [example, setExample] = useState(''); const [review, setReview] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const command = useRef<string>();
  async function save() {
    if (busy) return; setBusy(true); setError(''); command.current ||= crypto.randomUUID();
    try {
      const result = await addRequirementEvidence({ offerId, requirementId, inputHash, example, commandId: command.current });
      if ('error' in result) { setError(es ? 'No se pudo guardar. Conserva el texto y actualiza el análisis si ha cambiado.' : 'Could not save. Keep your text and refresh the analysis if it changed.'); return; }
      setOpen(false); setExample(''); command.current = undefined; router.refresh();
    } catch { setError(es ? 'No se pudo guardar. Puedes reintentar.' : 'Could not save. You can retry.'); }
    finally { setBusy(false); }
  }
  if (usage?.plan === 'guest') return <a className="inline-flex min-h-11 items-center text-sm underline" href={`/register?next=${encodeURIComponent(`/dashboard/applications/offer/${offerId}`)}`}>{es ? 'Crea una cuenta para guardar tu experiencia' : 'Create an account to save your experience'}</a>;
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{es ? 'Aportar experiencia' : 'Add experience'}</Button>;
  return <div className="space-y-3 rounded-lg border border-control bg-canvas p-3">
    <label className="block text-sm font-medium">{es ? 'Tu ejemplo real: contexto, contribución y resultado conocido' : 'Your real example: context, contribution and known outcome'}<textarea rows={4} maxLength={4000} value={example} disabled={busy || review} onChange={event => { setExample(event.target.value); command.current = undefined; }} className="mt-2 w-full rounded-lg border border-control bg-surface p-3" /></label>
    <p className="text-xs text-text-muted">{es ? 'Indica si fue empleo, prácticas, formación o voluntariado. Un ejemplo no sustituye una certificación obligatoria.' : 'State whether this was employment, a placement, training or volunteering. An example does not replace a required qualification.'}</p>
    {review && <p className="text-sm">{es ? 'Este texto se añadirá a tu perfil reutilizable. Confirma que describe hechos reales. No cambia tu CV ni consume IA.' : 'This text will be added to your reusable profile. Confirm it describes real facts. It does not change your CV or use AI.'}</p>}
    {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || example.trim().length < 20} onClick={() => review ? void save() : setReview(true)}>{review ? es ? 'Confirmar y guardar' : 'Confirm and save' : es ? 'Revisar aportación' : 'Review example'}</Button><Button variant="ghost" disabled={busy} onClick={() => review ? setReview(false) : setOpen(false)}>{es ? 'Cancelar' : 'Cancel'}</Button></div>
  </div>;
}
