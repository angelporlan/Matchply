'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, FileText, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Language } from '@/lib/i18n/types';
import {
  advanceLandingDemo,
  canPlayLandingDemo,
  landingDemoStage,
  LANDING_DEMO_DURATION_MS,
  LANDING_DEMO_STAGE_MS,
  type LandingDemoStage,
} from '@/lib/landing-demo';

const copy = {
  es: {
    example: 'Ejemplo con datos ficticios',
    demo: 'Cómo se adapta un CV en Matchply',
    steps: ['CV', 'Oferta', 'Revisión', 'PDF'],
    titles: ['Tu experiencia como punto de partida', 'Una oferta concreta', 'Tú decides qué cambios conservar', 'Tu CV, listo para descargar'],
    subtitles: ['El original se conserva.', 'Requisitos que ya puedes demostrar.', 'Más claridad, mismos hechos.', 'Plantilla Harvard · PDF A4'],
    name: 'Ana Rivera',
    role: 'Administración contable',
    company: 'Luma Estudio',
    experience: 'Experiencia',
    original: 'Gestión de facturas y conciliaciones bancarias. Seguimiento en Excel.',
    revised: 'Gestión y seguimiento de facturas y conciliaciones bancarias en Excel.',
    job: 'Buscamos una persona para nuestro equipo de administración contable.',
    requirements: ['Gestión de facturas', 'Conciliaciones bancarias', 'Manejo de Excel'],
    originalLabel: 'Texto original',
    originalCvLabel: 'CV original',
    revisedLabel: 'Propuesta revisable',
    facts: 'Sin añadir experiencia ni cifras.',
    ready: 'PDF listo',
    page: '1 página',
    pause: 'Pausar',
    resume: 'Continuar',
    replay: 'Repetir',
    pauseLabel: 'Pausar la demostración',
    resumeLabel: 'Continuar la demostración',
    replayLabel: 'Ver la demostración desde el principio',
    selectStep: 'Ver paso',
    static: 'Vista estática',
    finished: 'Ejemplo terminado',
    duration: 'Recorrido de 12 segundos',
  },
  en: {
    example: 'Example with fictional data',
    demo: 'How Matchply adapts a CV',
    steps: ['CV', 'Job', 'Review', 'PDF'],
    titles: ['Start with your experience', 'One specific job', 'You choose which changes to keep', 'Your CV, ready to download'],
    subtitles: ['Your original is preserved.', 'Skills you can already demonstrate.', 'Clearer wording. The same facts.', 'Harvard template · A4 PDF'],
    name: 'Ana Rivera',
    role: 'Accounting administration',
    company: 'Luma Studio',
    experience: 'Experience',
    original: 'Invoice management and bank reconciliations. Tracking in Excel.',
    revised: 'Managed and tracked invoices and bank reconciliations using Excel.',
    job: 'We are looking for someone to join our accounting administration team.',
    requirements: ['Invoice management', 'Bank reconciliations', 'Excel proficiency'],
    originalLabel: 'Original wording',
    originalCvLabel: 'Original CV',
    revisedLabel: 'Suggested wording',
    facts: 'No added experience or figures.',
    ready: 'PDF ready',
    page: '1 page',
    pause: 'Pause',
    resume: 'Resume',
    replay: 'Replay',
    pauseLabel: 'Pause the demonstration',
    resumeLabel: 'Resume the demonstration',
    replayLabel: 'View the demonstration from the beginning',
    selectStep: 'View step',
    static: 'Static view',
    finished: 'Example finished',
    duration: '12-second walkthrough',
  },
} satisfies Record<Language, Record<string, string | string[]>>;

export default function LandingDemo({ language }: { language: Language }) {
  const text = copy[language];
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  const [stage, setStage] = useState<LandingDemoStage>(0);
  const [inView, setInView] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        elapsedRef.current = LANDING_DEMO_DURATION_MS;
        setStage(3);
        setComplete(true);
      }
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    if (!('IntersectionObserver' in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting && entry.intersectionRatio >= 0.25);
    }, { threshold: [0, 0.25] });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setDocumentVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!canPlayLandingDemo({ inView, documentVisible, reducedMotion, paused, complete })) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      // Check synchronously as well: a background tab must never skip the walkthrough.
      if (document.hidden) {
        previous = performance.now();
        return;
      }
      const now = performance.now();
      elapsedRef.current = advanceLandingDemo(elapsedRef.current, now - previous);
      previous = now;
      setStage(landingDemoStage(elapsedRef.current));
      if (elapsedRef.current >= LANDING_DEMO_DURATION_MS) setComplete(true);
    }, 100);
    return () => window.clearInterval(timer);
  }, [inView, documentVisible, reducedMotion, paused, complete]);

  function selectStage(nextStage: LandingDemoStage) {
    elapsedRef.current = nextStage * LANDING_DEMO_STAGE_MS;
    setStage(nextStage);
    setPaused(true);
    setComplete(false);
  }

  function replay() {
    elapsedRef.current = 0;
    setStage(0);
    setComplete(false);
    setPaused(reducedMotion);
  }

  const isPdf = stage === 3;
  const isPaper = stage === 0 || isPdf;
  const StageIcon = stage === 1 ? BriefcaseBusiness : stage === 2 ? Sparkles : FileText;

  return (
    <div ref={rootRef} aria-label={text.demo} className="w-full min-w-0 overflow-hidden rounded-[20px] border border-control bg-surface shadow-[0_8px_0_0_var(--surface-muted)]">
      <div className="flex min-h-10 items-center gap-2 border-b border-subtle bg-surface-muted px-4 text-xs font-medium text-text-muted sm:px-5">
        <FileText className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        <span>{text.example}</span>
      </div>

      <div className="grid grid-cols-4 gap-1 border-b border-subtle p-2 sm:gap-2" aria-label={text.demo}>
        {text.steps.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => selectStage(index as LandingDemoStage)}
            aria-label={`${text.selectStep} ${index + 1}: ${label}`}
            aria-pressed={stage === index}
            aria-controls={panelId}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-md border px-1 py-2 text-xs font-semibold transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:gap-2 ${stage === index ? 'border-control bg-text text-canvas' : 'border-transparent text-text-muted hover:bg-surface-muted'}`}
          >
            <span aria-hidden="true" className={`hidden h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] sm:flex ${stage > index ? 'bg-success-surface text-success-text' : ''}`}>
              {stage > index ? <Check className="h-3 w-3" strokeWidth={2} /> : index + 1}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div id={panelId} className="px-4 pb-3 pt-4 sm:px-5">
        <div className="mb-3 h-[88px]">
          <div className="flex items-start gap-2">
            <StageIcon className={`mt-1 h-4 w-4 shrink-0 ${stage === 2 ? 'text-ai-text' : 'text-text-muted'}`} strokeWidth={1.75} aria-hidden="true" />
            <h3 className="font-display text-lg font-semibold leading-snug text-text">{text.titles[stage]}</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-text-muted">{text.subtitles[stage]}</p>
        </div>

        {/* All frames reserve the same space; no editor, renderer or remote asset is mounted. */}
        <div key={stage} className="demo-frame h-[300px]">
          {isPaper ? (
            <div className="flex h-full flex-col">
              <div className="relative min-h-0 flex-1 rounded-sm border border-slate-300 bg-white p-4 text-slate-900 shadow-sm sm:p-5">
                <div className="border-b border-slate-800 pb-3">
                  <p className="font-serif text-2xl font-bold leading-tight">{text.name}</p>
                  <p className="mt-1 text-xs leading-5">{text.role}</p>
                  <p className="mt-1 text-xs text-slate-600">ana@example.com</p>
                </div>
                <p className="mt-4 border-b border-slate-300 pb-1 font-serif text-sm font-bold">{text.experience}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-semibold">
                  <span>{text.company}</span>
                  <span>2022–2025</span>
                </div>
                <p className={`mt-2 rounded-sm text-xs leading-5 ${isPdf ? 'border-l-2 border-emerald-700 bg-emerald-50 py-1 pl-2 pr-1' : ''}`}>
                  {isPdf ? text.revised : text.original}
                </p>
              </div>
              <div className="flex min-h-9 items-center justify-between gap-2 pt-2 text-xs font-medium text-text-muted">
                {isPdf ? <span className="flex items-center gap-1.5 text-success-text"><Check className="h-3.5 w-3.5" aria-hidden="true" />{text.ready}</span> : <span>{text.originalCvLabel}</span>}
                <span>{text.page}</span>
              </div>
            </div>
          ) : stage === 1 ? (
            <div className="flex h-full flex-col rounded-lg border border-subtle bg-surface-muted p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-subtle bg-surface font-display text-lg font-semibold text-text" aria-hidden="true">L</div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-text-muted">{text.company}</p>
                  <p className="mt-0.5 font-display text-base font-semibold leading-snug text-text">{text.role}</p>
                </div>
              </div>
              <p className="mt-5 text-sm leading-6 text-text">{text.job}</p>
              <ul className="mt-5 space-y-3 text-sm leading-5 text-text">
                {text.requirements.map((requirement) => <li key={requirement} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" strokeWidth={1.75} aria-hidden="true" /><span>{requirement}</span></li>)}
              </ul>
            </div>
          ) : (
            <div className="flex h-full flex-col gap-3">
              <div className="rounded-lg border border-subtle bg-surface-muted p-3 sm:p-4">
                <p className="mb-1.5 text-xs font-semibold text-text-muted">{text.originalLabel}</p>
                <p className="text-sm leading-6 text-text">{text.original}</p>
              </div>
              <div className="rounded-lg border border-ai-text bg-ai-surface p-3 sm:p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ai-text"><Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />{text.revisedLabel}</p>
                <p className="text-sm leading-6 text-text">{text.revised}</p>
              </div>
              <p className="flex items-start gap-1.5 text-xs leading-5 text-text-muted"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{text.facts}</p>
            </div>
          )}
        </div>
      </div>

      <span role="status" aria-live="polite" className="sr-only">{stage + 1} / 4: {text.titles[stage]}</span>

      <div className="flex min-h-14 items-center justify-between gap-2 border-t border-subtle bg-surface-muted px-3 py-1.5 sm:px-4">
        <p className="hidden text-xs text-text-muted sm:block">{reducedMotion ? text.static : complete ? text.finished : text.duration}</p>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" onClick={() => setPaused(value => !value)} disabled={reducedMotion || complete} aria-label={paused ? text.resumeLabel : text.pauseLabel} className="min-h-11 px-2 text-xs">
            {paused ? <Play className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
            {paused ? text.resume : text.pause}
          </Button>
          <Button variant="ghost" onClick={replay} aria-label={text.replayLabel} className="min-h-11 px-2 text-xs"><RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />{text.replay}</Button>
        </div>
      </div>
      <style jsx>{`
        .demo-frame { animation: demo-frame-enter 180ms ease-out; }
        @keyframes demo-frame-enter {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .demo-frame { animation: none; }
        }
      `}</style>
    </div>
  );
}
