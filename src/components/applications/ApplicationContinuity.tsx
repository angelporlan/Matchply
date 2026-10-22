'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getApplicationTimeline, runApplicationCommand } from '@/app/dashboard/applications/actions';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Button } from '@/components/ui/Button';

type Followup = { nextFollowupDate: Date | string | null; nextAction: string | null; followupVersion: number };
export default function ApplicationContinuity({ offerId, followup, onUpdated, onConfirmSent }: { offerId: string; followup: Followup; onConfirmSent: () => void; onUpdated: (value: Followup) => void }) {
  const { language } = useLanguage(); const es = language === 'es'; const router = useRouter();
  const [date, setDate] = useState(''); const [action, setAction] = useState(followup.nextAction || '');
  const [events, setEvents] = useState<Awaited<ReturnType<typeof getApplicationTimeline>>>([]);
  const [page, setPage] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const command = useRef<{ signature: string; id: string }>();
  useEffect(() => { setDate(followup.nextFollowupDate ? new Date(followup.nextFollowupDate).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }) : ''); setAction(followup.nextAction || ''); }, [followup.nextFollowupDate, followup.nextAction]);
  useEffect(() => { let active = true; void getApplicationTimeline(offerId, page).then(value => { if (active) setEvents(value); }).catch(() => { if (active) setError(es ? 'No se pudo cargar el historial.' : 'Could not load the history.'); }); return () => { active = false; }; }, [offerId, page, busy, es]);
  async function run(kind: 'complete' | 'postpone' | 'schedule' | 'response') {
    if (busy) return; setBusy(true); setError('');
    const signature = JSON.stringify({ kind, date, action, version: followup.followupVersion });
    if (command.current?.signature !== signature) command.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await runApplicationCommand(offerId, { commandId: command.current.id, action: kind, version: followup.followupVersion, ...(kind === 'schedule' || kind === 'postpone' ? { nextFollowupDate: date ? new Date(`${date}T12:00:00+01:00`) : null, nextAction: action.trim() || null } : {}) });
      if ('error' in result) { setError(es ? 'No se pudo guardar. Recarga si otra ventana ha cambiado la acción.' : 'Could not save. Reload if another window changed the action.'); router.refresh(); return; }
      onUpdated(result); command.current = undefined; router.refresh();
    } catch { setError(es ? 'No se pudo guardar. Puedes reintentar.' : 'Could not save. You can retry.'); }
    finally { setBusy(false); }
  }
  const labels: Record<string, string> = es ? { sent: 'Envío confirmado', status_changed: 'Cambio de fase', followup_scheduled: 'Seguimiento programado', followup_completed: 'Acción completada', followup_postponed: 'Acción pospuesta', response: 'Respuesta registrada', reviewed: 'Adaptación revisada', document_viewed: 'Documento consultado' } : { sent: 'Submission confirmed', status_changed: 'Stage changed', followup_scheduled: 'Follow-up scheduled', followup_completed: 'Action completed', followup_postponed: 'Action postponed', response: 'Response recorded', reviewed: 'Tailoring reviewed', document_viewed: 'Document viewed' };
  return <section className="rounded-xl border border-subtle bg-surface p-5 space-y-4">
    <h2 className="font-display text-lg font-semibold">{es ? 'Próximo paso' : 'Next step'}</h2>
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-48 flex-1 text-sm">{es ? 'Acción' : 'Action'}<input value={action} onChange={event => setAction(event.target.value)} maxLength={1000} placeholder={es ? 'Hacer seguimiento' : 'Follow up'} className="mt-1 min-h-11 w-full rounded-lg border border-control bg-canvas px-3" /></label>
      <label className="text-sm">{es ? 'Fecha' : 'Date'}<input type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-control bg-canvas px-3" /></label>
      <Button disabled={busy || !date} onClick={() => void run('schedule')}>{es ? 'Guardar' : 'Save'}</Button>
      {followup.nextFollowupDate && <><Button variant="secondary" disabled={busy} onClick={() => void run('complete')}>{es ? 'Hecho' : 'Done'}</Button><Button variant="ghost" disabled={busy || !date} onClick={() => void run('postpone')}>{es ? 'Posponer' : 'Postpone'}</Button></>}
    </div>
    <Button variant="secondary" disabled={busy} onClick={onConfirmSent}>{es ? 'Registrar envío' : 'Record submission'}</Button>
    <Button variant="ghost" disabled={busy} onClick={() => void run('response')}>{es ? 'He recibido una respuesta' : 'I received a response'}</Button>
    {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
    <details><summary className="cursor-pointer py-2 font-semibold">{es ? 'Historial y documentos enviados' : 'History and submitted documents'}</summary>
      {!events.length && <p className="py-3 text-sm text-text-muted">{es ? 'Estado previo al registro de historial. Documento no conservado.' : 'State predates history tracking. Document not retained.'}</p>}
      <ol className="divide-y divide-subtle">{events.map(event => <li key={event.id} className="space-y-2 py-3 text-sm">
        <p><time>{new Date(event.createdAt).toLocaleString(es ? 'es-ES' : 'en-GB')}</time> · {labels[event.kind] || event.kind}{event.kind === 'status_changed' && ` · ${String(event.payload.from)} → ${String(event.payload.to)}`}</p>
        {event.payload.cancelled === true && <p className="text-text-muted">{es ? 'Seguimiento cancelado' : 'Follow-up cancelled'}</p>}
        {Boolean(event.payload.action || event.payload.previousAction) && <p>{String(event.payload.action || event.payload.previousAction)}</p>}
        {event.kind === 'sent' && (event.exportId ? <div className="flex flex-wrap gap-4"><a href={`/api/cv/exports/${event.exportId}`} className="underline">{event.filename || (es ? 'Descargar documento enviado' : 'Download submitted document')}</a><button type="button" className="text-danger-text underline" onClick={async () => { if (!window.confirm(es ? '¿Eliminar esta copia conservada?' : 'Delete this retained copy?')) return; const response = await fetch(`/api/cv/exports/${event.exportId}`, { method: 'DELETE' }); if (response.ok) setEvents(await getApplicationTimeline(offerId, page)); else setError(es ? 'No se pudo eliminar.' : 'Could not delete.'); }}>{es ? 'Eliminar copia' : 'Delete copy'}</button></div> : <p className="text-text-muted">{es ? 'Documento no conservado' : 'Document not retained'}</p>)}
      </li>)}</ol>
      <div className="flex gap-3"><Button variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>{es ? 'Anterior' : 'Previous'}</Button><Button variant="ghost" disabled={events.length < 20} onClick={() => setPage(page + 1)}>{es ? 'Siguiente' : 'Next'}</Button></div>
    </details>
  </section>;
}
