'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ModalScrim } from '@/components/ui/ModalScrim';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { problemReportContext } from '@/lib/client-diagnostics';
import { ERROR_STEPS, type ErrorStep } from '@/lib/diagnostics-schema';
import { REPORT_COMMENT_MAX } from '@/lib/problem-report-schema';
import { reportStepLabel } from '@/lib/problem-report-copy';

export default function ProblemReportButton() {
  const path = usePathname(), { language } = useLanguage(), en = language === 'en';
  const [open, setOpen] = useState(false), [comment, setComment] = useState('');
  const [context, setContext] = useState<ReturnType<typeof problemReportContext> | null>(null);
  const [busy, setBusy] = useState(false), [sent, setSent] = useState<string | null>(null), [error, setError] = useState('');
  const lock = useRef(false), pending = useRef<{ signature: string; id: string } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null), dialog = useRef<HTMLDivElement>(null);
  const enabled = path === '/try' || path === '/register' || path.startsWith('/editor/') || path === '/dashboard' || path.startsWith('/dashboard/');
  useEffect(() => {
    if (!open || !enabled) return;
    const restore = trigger.current;
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !lock.current) { event.preventDefault(); setOpen(false); }
      if (event.key !== 'Tab') return;
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || []);
      const first = elements[0], last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); restore?.focus(); };
  }, [open, enabled]);
  if (!enabled) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lock.current || !context || sent) return;
    lock.current = true; setBusy(true); setError('');
    const body = { ...context, comment }, signature = JSON.stringify(body);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const id = pending.current.id;
    try {
      const response = await fetch('/api/diagnostics/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, id }), signal: AbortSignal.timeout(10_000) });
      if (!response.ok) { if (response.status === 429) throw new Error('rate'); throw new Error('failed'); }
      const result = await response.json();
      if (!result.accepted || result.id !== id) throw new Error('failed');
      setSent(id);
    } catch (failure) {
      setError(failure instanceof Error && failure.message === 'rate'
        ? en ? 'Too many reports. Wait ten minutes and try again; your draft is preserved.' : 'Has enviado varios avisos. Espera diez minutos y reintenta; conservamos tu borrador.'
        : en ? 'Could not confirm delivery. Your draft is preserved; try sending it again.' : 'No se pudo confirmar el envío. Conservamos tu borrador; vuelve a enviarlo.');
    } finally { lock.current = false; setBusy(false); }
  };
  const title = en ? 'Did something go wrong?' : '¿Algo falló?';
  return <>
    <Button ref={trigger} variant="secondary" className="fixed right-4 z-40 bg-surface shadow-sm" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      onClick={() => {
        if (!context || sent || (!comment.trim() && !pending.current)) { setContext(problemReportContext(path)); setComment(''); setSent(null); pending.current = null; }
        setError(''); setOpen(true);
      }}><MessageSquare className="h-4 w-4" aria-hidden />{title}</Button>
    {open && <ModalScrim>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="problem-report-title" tabIndex={-1}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-subtle bg-surface p-5 sm:p-6 shadow-dialog text-text">
        <div className="flex items-start justify-between gap-3"><h2 id="problem-report-title" className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" aria-label={en ? 'Close report' : 'Cerrar aviso'} disabled={busy} onClick={() => setOpen(false)}><X className="h-4 w-4" aria-hidden /></Button></div>
        {sent ? <div role="status" className="mt-4 space-y-3"><p>{en ? 'Report received. Thank you for telling us.' : 'Aviso recibido. Gracias por contárnoslo.'}</p><p className="break-all text-xs font-mono">{en ? 'Report ID' : 'ID del aviso'}: {sent}</p>
          <Button variant="secondary" onClick={() => setOpen(false)}>{en ? 'Close' : 'Cerrar'}</Button></div> : <form className="mt-4 space-y-4" onSubmit={submit}>
          <p className="text-sm text-text-muted">{en ? 'We will send the request reference and step to Matchply support. Your comment is optional. Reports are kept for 30 days.' : 'Enviaremos la referencia de la petición y el paso al soporte de Matchply. El comentario es opcional. Los avisos se conservan 30 días.'}</p>
          <p className="break-all text-xs font-mono">{en ? 'Request ID' : 'ID de petición'}: {context?.requestId || (en ? 'No request reference available' : 'Sin referencia de petición disponible')}</p>
          <label className="block space-y-2 text-sm font-medium"><span>{en ? 'Step where it happened' : 'Paso en el que ocurrió'}</span>
            <select value={context?.step || 'unknown'} disabled={busy} onChange={event => setContext(current => current && ({ ...current, step: event.target.value as ErrorStep }))}
              className="w-full min-h-11 rounded-lg border border-control bg-canvas px-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
              {ERROR_STEPS.map(step => <option key={step} value={step}>{reportStepLabel(step, language)}</option>)}
            </select></label>
          <label className="block space-y-2 text-sm font-medium"><span>{en ? 'What happened? (optional)' : '¿Qué pasó? (opcional)'}</span>
            <textarea value={comment} onChange={event => setComment(event.target.value)} disabled={busy} rows={4} maxLength={REPORT_COMMENT_MAX}
              aria-describedby="problem-report-help" className="w-full rounded-lg border border-control bg-canvas p-3 text-base text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" /></label>
          <p id="problem-report-help" className="text-sm text-text-muted">{en ? 'Describe the problem without pasting your resume, passwords or personal details.' : 'Describe el problema sin pegar tu CV, contraseñas ni datos personales.'}</p>
          {error && <p role="alert" className="text-sm text-danger-text">{error}</p>}
          <div className="flex flex-wrap justify-end gap-3"><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>{en ? 'Cancel' : 'Cancelar'}</Button>
            <Button type="submit" variant="strong" loading={busy} disabled={busy}>{en ? 'Send report' : 'Enviar aviso'}</Button></div>
        </form>}
      </div>
    </ModalScrim>}
  </>;
}
