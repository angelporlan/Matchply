"use client";

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CV } from '@/db/schema';
import {
  Sparkles, Plus, FileText, Trash2, ArrowRight, Star, X,
  Briefcase, Building2, Link as LinkIcon, RefreshCw, AlertCircle,
  Crown, Lock
} from 'lucide-react';
import { createBaseCv, deleteCv, setPrincipalCv } from './actions';
import AlertModal from '@/components/ui/AlertModal';

const promptConfigs: Record<
  string,
  {
    color: string;
    hoverBg: string;
    text: string;
    bg: string;
    activeBorder: string;
    desc: string;
  }
> = {
  'Modo Fidelidad': {
    color: '#38bdf8', // Azulito (sky-400)
    hoverBg: 'hover:bg-sky-500/5',
    text: 'text-sky-400',
    bg: 'bg-sky-500/10',
    activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
    desc: 'Fidelidad absoluta a tu trayectoria real. No inventa habilidades ni herramientas; optimiza tu redacción e integra palabras clave para pasar filtros ATS.'
  },
  'Modo Rendimiento': {
    color: '#eab308', // Amarillo (yellow-500)
    hoverBg: 'hover:bg-yellow-500/5',
    text: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    activeBorder: 'border-yellow-500 ring-2 ring-yellow-500/20',
    desc: 'Amplía y potencia tu experiencia de forma realista. Si dominas tecnologías equivalentes, las integra estratégicamente y optimiza la densidad ATS.'
  },
  'Modo Extremo': {
    color: '#ea580c', // Naranjado casi rojo (orange-600)
    hoverBg: 'hover:bg-orange-500/5',
    text: 'text-orange-400',
    bg: 'bg-orange-500/10',
    activeBorder: 'border-orange-500 ring-2 ring-orange-500/20',
    desc: 'Foco absoluto en superar el filtro ATS. Adapta tu CV e inyecta cualquier tecnología o requisito crítico exigido por la oferta para un match del 100%.'
  }
};

const defaultPromptConfig = {
  color: '#38bdf8',
  hoverBg: 'hover:bg-sky-500/5',
  text: 'text-sky-400',
  bg: 'bg-sky-500/10',
  activeBorder: 'border-sky-500 ring-2 ring-sky-500/20',
  desc: 'Optimiza tu currículum de acuerdo a la oferta elegida.'
};

interface DashboardClientProps {
  initialCvs: CV[];
  isPremium: boolean;
  availablePrompts: { id: string; name: string; isActive: boolean }[];
}

export default function DashboardClient({
  initialCvs,
  isPremium,
  availablePrompts
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [userCvs, setUserCvs] = useState<CV[]>(initialCvs);

  // Estados de control de modals
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [cvToDelete, setCvToDelete] = useState<string | null>(null);

  // Estados de IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiFormData, setAiFormData] = useState({
    jobTitle: '',
    company: '',
    url: '',
    platform: 'linkedin',
    jobDescription: '',
    promptId: availablePrompts.find(p => p.isActive)?.id || '',
    addToKanban: 'true',
  });

  // Estado para creación rápida de CV
  const [newCvTitle, setNewCvTitle] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Buscar el CV principal actual
  const principalCv = userCvs.find(cv => cv.isPrincipal);

  // Sincronizar estado local con props de entrada cuando cambien
  if (JSON.stringify(initialCvs) !== JSON.stringify(userCvs)) {
    setUserCvs(initialCvs);
  }

  // Manejar creación rápida
  const handleCreateQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCvTitle.trim() || createLoading) return;

    setCreateLoading(true);
    try {
      const res = await createBaseCv(newCvTitle.trim());
      if (res.success && res.cvId) {
        router.push(`/editor/${res.cvId}`);
      } else {
        alert(res.error || 'Error al crear el currículum.');
      }
    } catch (err) {
      console.error(err);
      alert('Ocurrió un error inesperado.');
    } finally {
      setCreateLoading(false);
    }
  };

  // Manejar marcar principal
  const handleMarkAsPrincipal = (cvId: string) => {
    startTransition(async () => {
      // Optimistic update
      setUserCvs(prev => prev.map(cv => ({
        ...cv,
        isPrincipal: cv.id === cvId
      })));

      const res = await setPrincipalCv(cvId);
      if (res.error) {
        // Revertir si falla
        setUserCvs(initialCvs);
        alert(res.error);
      }
    });
  };

  // Confirmar eliminación de CV
  const triggerDelete = (cvId: string) => {
    setCvToDelete(cvId);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!cvToDelete) return;

    setIsDeleteOpen(false);
    const targetId = cvToDelete;
    setCvToDelete(null);

    startTransition(async () => {
      // Optimistic update
      setUserCvs(prev => prev.filter(cv => cv.id !== targetId));

      const res = await deleteCv(targetId);
      if (res.error) {
        setUserCvs(initialCvs);
        alert(res.error);
      }
    });
  };

  // Acción del botón Generar con IA
  const handleAiButtonClick = () => {
    if (!principalCv) {
      setIsAlertOpen(true);
    } else {
      setIsAiOpen(true);
    }
  };

  // Optimización IA con estados progresivos fluidos
  const handleAiOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiError(null);

    if (!principalCv) {
      setAiError('No hay ningún CV principal designado.');
      return;
    }

    if (!aiFormData.jobTitle || !aiFormData.company || !aiFormData.jobDescription) {
      setAiError('El puesto, empresa y descripción de la oferta son obligatorios.');
      return;
    }

    setAiLoading(true);

    // Simular pasos fluidos de IA para dar un feedback ultra-premium
    const steps = [
      'Extrayendo palabras clave de la oferta...',
      'Analizando tu experiencia y habilidades del CV Principal...',
      'Alineando tu perfil con los requisitos clave...',
      'Generando copia optimizada sin perder la verdad del contenido...',
      'Creando CV y registrando candidatura en el Kanban...'
    ];

    let currentStepIndex = 0;
    setAiStep(steps[currentStepIndex]);

    const stepInterval = setInterval(() => {
      if (currentStepIndex < steps.length - 1) {
        currentStepIndex++;
        setAiStep(steps[currentStepIndex]);
      }
    }, 2000);

    try {
      const response = await fetch('/api/ai/optimize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          baseCvId: principalCv.id,
          jobTitle: aiFormData.jobTitle,
          company: aiFormData.company,
          url: aiFormData.url,
          platform: aiFormData.platform,
          jobDescription: aiFormData.jobDescription,
          promptId: aiFormData.promptId,
          addToKanban: aiFormData.addToKanban === 'true',
        }),
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Error en la optimización.');
      }

      const result = await response.json();

      setAiStep('¡Completado con éxito! Redirigiendo...');
      setTimeout(() => {
        setIsAiOpen(false);
        setAiLoading(false);
        router.push(`/editor/${result.cvId}`);
      }, 1000);

    } catch (err: any) {
      clearInterval(stepInterval);
      setAiError(err.message || 'Ocurrió un error inesperado.');
      setAiLoading(false);
    }
  };

  return (
    <div>
      {/* Cabecera Tus Currículums */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-[#1E1B4B] dark:text-white flex items-center gap-2 font-display">
            Tus Currículums
            {principalCv && (
              <span className="text-[10px] py-0.5 px-2 bg-[#8B5CF6]/10 text-[#8B5CF6] dark:text-violet-400 border border-[#8B5CF6]/20 rounded-full font-medium tracking-wide flex items-center gap-1 font-sans">
                <Star className="w-2.5 h-2.5 fill-[#8B5CF6]" />
                Principal: {principalCv.title}
              </span>
            )}
          </h3>
          <p className="text-[#1E1B4B]/60 dark:text-slate-400 text-xs font-light font-sans">Crea tu currículum base, marca tu principal o genera copias optimizadas.</p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Crear nuevo CV rápido */}
          <form onSubmit={handleCreateQuick} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              required
              value={newCvTitle}
              onChange={(e) => setNewCvTitle(e.target.value)}
              placeholder="Nombre del nuevo CV..."
              className="bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[8px] px-4 py-2 text-xs text-[#1E1B4B] dark:text-white placeholder-[#1E1B4B]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] transition-all w-full sm:w-44"
              disabled={createLoading}
            />
            <button
              type="submit"
              disabled={createLoading}
              className="bg-[#1E1B4B] hover:bg-[#1E1B4B]/90 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#0B0F19] font-bold px-4 py-2 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 font-display"
            >
              {createLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 stroke-[1.75]" />
              )}
              Crear CV
            </button>
          </form>

          {/* Separador */}
          <div className="hidden sm:block h-6 w-[1px] bg-[#1E1B4B]/10 dark:bg-white/10 mx-1" />

          {/* Botón premium de Generar con IA */}
          <button
            onClick={handleAiButtonClick}
            className={`font-bold px-4 py-2.5 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-sm font-display hover:-translate-y-0.5 ${principalCv
                ? 'bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 text-white border border-[#8B5CF6]/20'
                : 'bg-white dark:bg-[#1F2937] text-[#1E1B4B]/40 dark:text-slate-500 border border-[#1E1B4B]/10 dark:border-white/5 cursor-not-allowed'
              }`}
          >
            {principalCv ? (
              <Sparkles className="w-4 h-4 text-purple-200 animate-pulse stroke-[1.75]" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-[#1E1B4B]/40 dark:text-slate-500 stroke-[1.75]" />
            )}
            <span>Generar con IA</span>
          </button>
        </div>
      </div>

      {userCvs.length === 0 ? (
        <div className="bg-white dark:bg-[#1F2937] border border-[#1E1B4B]/10 dark:border-white/5 border-dashed rounded-[12px] p-12 text-center shadow-sm">
          <div className="bg-[#FAFAFA] dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 p-4 rounded-full text-[#1E1B4B]/50 dark:text-slate-400 w-fit mx-auto mb-4">
            <FileText className="w-8 h-8 stroke-[1.75]" />
          </div>
          <h4 className="text-base font-bold text-[#1E1B4B] dark:text-white mb-1.5 font-display">No tienes ningún currículum todavía</h4>
          <p className="text-[#1E1B4B]/60 dark:text-slate-400 text-xs font-light max-w-sm mx-auto mb-6 font-sans">
            Escribe un título en el campo superior derecho y presiona &quot;Crear CV&quot; para generar tu primer borrador en Markdown. ¡Se marcará como principal automáticamente!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userCvs.map((cv) => (
            <div
              key={cv.id}
              className={`bg-white dark:bg-[#1F2937] p-6 rounded-[12px] border transition-all relative overflow-hidden group flex flex-col justify-between shadow-sm hover:shadow-md ${cv.isPrincipal
                  ? 'border-[#8B5CF6]/30 dark:border-[#8B5CF6]/40 bg-[#8B5CF6]/2 dark:bg-[#8B5CF6]/2'
                  : 'border-[#1E1B4B]/10 dark:border-white/5 hover:border-[#1E1B4B]/20 dark:hover:border-white/10'
                }`}
            >
              {/* Decorative glowing accent */}
              <div
                className="absolute top-0 left-0 w-1.5 h-full"
                style={{ backgroundColor: cv.isPrincipal ? '#8B5CF6' : (cv.accentColor || '#1E1B4B') }}
              />

              <div>
                <div className="flex items-start justify-between mb-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${cv.isBase
                          ? 'bg-[#1E1B4B]/5 dark:bg-white/5 text-[#1E1B4B]/70 dark:text-slate-350 border-[#1E1B4B]/10 dark:border-white/10'
                          : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        }`}>
                        {cv.isBase ? 'Base' : 'Copia'}
                      </span>

                      {cv.isPrincipal && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6] dark:text-violet-400 border border-[#8B5CF6]/20 flex items-center gap-0.5 animate-pulse">
                          <Star className="w-2.5 h-2.5 fill-[#8B5CF6] stroke-[1.75]" />
                          Principal
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-[#1E1B4B] dark:text-white text-base leading-snug group-hover:text-[#8B5CF6] dark:group-hover:text-violet-400 transition-colors pt-0.5 font-display">
                      {cv.title}
                    </h4>
                  </div>

                  {/* Acciones de estrella principal */}
                  <button
                    onClick={() => !cv.isPrincipal && handleMarkAsPrincipal(cv.id)}
                    className={`p-1.5 rounded-lg border transition-all ${cv.isPrincipal
                        ? 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20 shadow-sm'
                        : 'bg-[#FAFAFA] dark:bg-[#0B0F19] text-[#1E1B4B]/40 dark:text-slate-400 border-[#1E1B4B]/10 dark:border-white/10 hover:text-[#8B5CF6] dark:hover:text-violet-400 hover:border-[#8B5CF6]/20 opacity-0 group-hover:opacity-100 transition-opacity'
                      }`}
                    title={cv.isPrincipal ? "CV Principal" : "Establecer como Principal"}
                    disabled={cv.isPrincipal || isPending}
                  >
                    <Star className={`w-4 h-4 ${cv.isPrincipal ? 'fill-[#8B5CF6] text-[#8B5CF6] stroke-[1.75]' : 'stroke-[1.75]'}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-2 text-[11px] font-light text-[#1E1B4B]/60 dark:text-slate-400 mb-6 font-sans">
                  <div className="bg-[#FAFAFA] dark:bg-[#0B0F19] border border-[#1E1B4B]/5 dark:border-white/5 px-2.5 py-1.5 rounded-[8px]">
                    <span className="block text-[9px] text-[#1E1B4B]/40 dark:text-slate-500 font-bold uppercase">Plantilla</span>
                    <span className="text-[#1E1B4B]/80 dark:text-slate-200 font-medium capitalize">{cv.templateName}</span>
                  </div>
                  <div className="bg-[#FAFAFA] dark:bg-[#0B0F19] border border-[#1E1B4B]/5 dark:border-white/5 px-2.5 py-1.5 rounded-[8px]">
                    <span className="block text-[9px] text-[#1E1B4B]/40 dark:text-slate-500 font-bold uppercase">Creado</span>
                    <span className="text-[#1E1B4B]/80 dark:text-slate-200 font-medium">
                      {new Date(cv.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#1E1B4B]/10 dark:border-white/5 pt-4 pl-2">
                <Link
                  href={`/editor/${cv.id}`}
                  className="text-xs font-semibold text-[#8B5CF6] dark:text-violet-400 hover:text-[#8B5CF6]/85 dark:hover:text-violet-300 flex items-center gap-1.5 group/link"
                >
                  Editar CV
                  <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform stroke-[1.75]" />
                </Link>

                <button
                  onClick={() => triggerDelete(cv.id)}
                  className="text-[#1E1B4B]/40 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 p-2 rounded-xl transition-all"
                  title="Borrar Currículum"
                  disabled={isPending}
                >
                  <Trash2 className="w-4 h-4 stroke-[1.75]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cajón Lateral / Modal de Optimización por IA */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1F2937] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[12px] max-h-[90vh] p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">

            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-[#8B5CF6]/3 dark:bg-[#8B5CF6]/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-[#8B5CF6]/3 dark:bg-[#8B5CF6]/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-[#1E1B4B] dark:text-white flex items-center gap-2 font-display">
                  <Sparkles className="w-5 h-5 text-[#8B5CF6] dark:text-violet-400 animate-pulse stroke-[1.75]" />
                  Optimización Inteligente por IA
                </h3>
                <p className="text-xs text-[#1E1B4B]/60 dark:text-slate-400 mt-1 font-sans">
                  Generaremos un currículum adaptado a partir de tu currículum principal: <strong className="text-[#8B5CF6] dark:text-violet-400 font-semibold">{principalCv?.title}</strong>.
                </p>
              </div>
              <button
                onClick={() => !aiLoading && setIsAiOpen(false)}
                className="text-[#1E1B4B]/60 dark:text-slate-400 hover:text-[#1E1B4B] dark:hover:text-white p-1 rounded-[8px] hover:bg-[#FAFAFA] dark:hover:bg-[#0B0F19]/45 transition-all disabled:opacity-50"
                disabled={aiLoading}
              >
                <X className="w-5 h-5 stroke-[1.75]" />
              </button>
            </div>

            {aiLoading ? (
              /* Loader Premium en Proceso */
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-4">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border border-[#8B5CF6]/20 flex items-center justify-center bg-[#8B5CF6]/5 shadow-sm">
                    <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin stroke-[1.75]" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-[#8B5CF6] animate-ping opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-[#1E1B4B] dark:text-white mb-2 font-display">Construyendo tu currículum adaptado</h4>
                <p className="text-xs text-[#1E1B4B]/60 dark:text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse font-sans">
                  {aiStep}
                </p>
              </div>
            ) : (
              /* Formulario */
              <div className="flex-1 overflow-y-auto pr-1 relative z-10 space-y-4 py-2 scrollbar-custom">
                {aiError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 dark:text-rose-450 text-xs rounded-[8px] font-medium font-sans">
                    {aiError}
                  </div>
                )}

                {!isPremium && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-500/90 text-xs rounded-[8px] flex items-start gap-3 font-sans">
                    <Crown className="w-5 h-5 shrink-0 mt-0.5 stroke-[1.75]" />
                    <div>
                      <span className="font-bold block mb-0.5 font-display">Atención: Plan Gratuito Activo</span>
                      El motor gratuito utiliza análisis estándar. Los socios PRO disfrutan de la máxima precisión semántica y velocidad de redacción con modelos de IA más avanzados.
                    </div>
                  </div>
                )}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E1B4B]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-[#1E1B4B]/50 dark:text-slate-400 stroke-[1.75]" />
                        Nombre del Puesto *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Ej. Frontend React Engineer"
                        className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1E1B4B] dark:text-white placeholder-[#1E1B4B]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E1B4B]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <Building2 className="w-3.5 h-3.5 text-[#1E1B4B]/50 dark:text-slate-400 stroke-[1.75]" />
                        Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Ej. Stripe"
                        className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1E1B4B] dark:text-white placeholder-[#1E1B4B]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E1B4B]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                        <LinkIcon className="w-3.5 h-3.5 text-[#1E1B4B]/50 dark:text-slate-400 stroke-[1.75]" />
                        Enlace a la Oferta
                      </label>
                      <input
                        type="url"
                        value={aiFormData.url}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://..."
                        className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1E1B4B] dark:text-white placeholder-[#1E1B4B]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#1E1B4B]/80 dark:text-slate-200 font-display">Plataforma</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1E1B4B] dark:text-white focus:outline-none focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] transition-all cursor-pointer font-sans"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">Otra</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-[#1E1B4B]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6] dark:text-violet-400 animate-pulse stroke-[1.75]" />
                      Modo de Optimización Inteligente
                    </label>
                    {availablePrompts.length === 0 ? (
                      <div className="w-full bg-[#FAFAFA] dark:bg-[#0B0F19]/40 border border-[#1E1B4B]/10 dark:border-white/5 rounded-[8px] px-4 py-3 text-xs text-[#1E1B4B]/60 dark:text-slate-400 font-sans">
                        Por defecto (Estilo Harvard)
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {availablePrompts.map((prompt) => {
                          const config = promptConfigs[prompt.name] || defaultPromptConfig;
                          const isSelected = aiFormData.promptId === prompt.id;
                          const shadowClass = prompt.name === 'Modo Fidelidad' 
                            ? 'shadow-sky-500/5' 
                            : prompt.name === 'Modo Rendimiento' 
                              ? 'shadow-yellow-500/5' 
                              : 'shadow-orange-500/5';
                          
                          return (
                            <div
                              key={prompt.id}
                              onClick={() => setAiFormData(prev => ({ ...prev, promptId: prompt.id }))}
                              className={`relative p-3.5 rounded-[8px] border bg-[#FAFAFA] dark:bg-[#0B0F19]/35 cursor-pointer transition-all duration-200 group flex flex-col justify-between select-none hover:-translate-y-0.5 ${config.hoverBg} ${isSelected ? `border-[#8B5CF6] ring-2 ring-[#8B5CF6]/20 shadow-lg ${shadowClass}` : 'border-[#1E1B4B]/10 dark:border-white/10 hover:border-[#1E1B4B]/20 dark:hover:border-white/20'}`}
                            >
                              <div>
                                {/* Header / Color dot */}
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className={`text-[8.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${config.bg} ${config.text}`}>
                                    {prompt.name.replace('Modo ', '')}
                                  </span>
                                  <div 
                                    className="w-2 h-2 rounded-full transition-transform group-hover:scale-125 shrink-0"
                                    style={{ backgroundColor: config.color }}
                                  />
                                </div>
                                
                                {/* Title */}
                                <h4 className="text-[11px] font-bold text-[#1E1B4B] dark:text-white mb-1 group-hover:text-[#8B5CF6] dark:group-hover:text-violet-400 transition-colors font-display">
                                  {prompt.name}
                                </h4>
                              </div>

                              {/* Description / Summary */}
                              <p className="text-[9.5px] text-[#1E1B4B]/60 dark:text-slate-400 leading-normal font-light font-sans">
                                {config.desc}
                              </p>

                              {/* Selected checkmark dot glow */}
                              {isSelected && (
                                <div 
                                  className="absolute top-[-1px] right-[-1px] w-2.5 h-2.5 rounded-full blur-[2.5px] opacity-70"
                                  style={{ backgroundColor: config.color }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 bg-[#FAFAFA] dark:bg-[#0B0F19]/30 p-4 rounded-[8px] border border-[#1E1B4B]/10 dark:border-white/5">
                    <input
                      type="checkbox"
                      id="addToKanban"
                      checked={aiFormData.addToKanban === 'true'}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, addToKanban: e.target.checked ? 'true' : 'false' }))}
                      className="rounded bg-white dark:bg-[#0B0F19] border-[#1E1B4B]/20 dark:border-white/20 text-[#8B5CF6] focus:ring-[#8B5CF6]/20 w-4 h-4 cursor-pointer accent-[#8B5CF6]"
                    />
                    <div className="flex flex-col">
                      <label htmlFor="addToKanban" className="text-xs font-bold text-[#1E1B4B]/80 dark:text-slate-200 cursor-pointer select-none flex items-center gap-1.5 font-display">
                        <Briefcase className="w-3.5 h-3.5 text-[#1E1B4B]/50 dark:text-slate-400 stroke-[1.75]" />
                        Registrar automáticamente en el Kanban
                      </label>
                      <span className="text-[10px] text-[#1E1B4B]/50 dark:text-slate-400 font-light mt-0.5 font-sans">
                        Si está activado, creará una nueva candidatura vinculada a esta oferta en tu tablero Kanban.
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#1E1B4B]/80 dark:text-slate-200 flex items-center gap-1.5 font-display">
                      <FileText className="w-3.5 h-3.5 text-[#1E1B4B]/50 dark:text-slate-400 stroke-[1.75]" />
                      Descripción / Requisitos de la Oferta *
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder="Pega aquí la descripción detallada de la oferta, incluyendo las responsabilidades y habilidades requeridas."
                      className="w-full bg-white dark:bg-[#0B0F19] border border-[#1E1B4B]/10 dark:border-white/10 rounded-[8px] px-3.5 py-2.5 text-sm text-[#1E1B4B] dark:text-white placeholder-[#1E1B4B]/40 dark:placeholder-slate-500 focus:outline-none focus:border-[#8B5CF6] dark:focus:border-[#8B5CF6] transition-all resize-none font-sans"
                    />
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#1E1B4B]/10 dark:border-white/5 shrink-0 relative z-10 font-display">
              <button
                type="button"
                onClick={() => setIsAiOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-[#1E1B4B]/60 dark:text-slate-400 hover:text-[#1E1B4B] dark:hover:text-white transition-colors disabled:opacity-50"
                disabled={aiLoading}
              >
                Cerrar
              </button>
              {!aiLoading && (
                <button
                  type="submit"
                  onClick={handleAiOptimize}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#8B5CF6] hover:bg-[#8B5CF6]/90 rounded-[8px] shadow-sm transition-all"
                >
                  <Sparkles className="w-4 h-4 animate-pulse stroke-[1.75]" />
                  Iniciar Optimización por IA
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AlertModal para advertencia de falta de CV Principal */}
      <AlertModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        title="Se requiere un CV Principal"
        message={`Para generar un nuevo currículum personalizado con IA desde el Dashboard, primero debes configurar uno de tus currículums como principal.

Esto nos sirve como base con toda tu información para que la IA realice una excelente adaptación.

Puedes marcar cualquiera de tus currículums haciendo clic en su icono de estrella en su tarjeta correspondiente.`}
        type="warning"
        confirmLabel="Entendido"
      />

      {/* AlertModal para confirmación de borrado */}
      <AlertModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setCvToDelete(null);
        }}
        title="¿Eliminar Currículum?"
        message="Esta acción no se puede deshacer y borrará permanentemente este currículum de tu cuenta. Si es tu currículum principal, reasignaremos automáticamente otra de tus bases como principal."
        type="danger"
        confirmLabel="Sí, eliminar"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
