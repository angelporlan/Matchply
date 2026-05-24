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
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Tus Currículums
            {principalCv && (
              <span className="text-[10px] py-0.5 px-2 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full font-medium tracking-wide flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-sky-400" />
                Principal: {principalCv.title}
              </span>
            )}
          </h3>
          <p className="text-slate-400 text-xs font-light">Crea tu currículum base, marca tu principal o genera copias optimizadas.</p>
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
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all w-full sm:w-44"
              disabled={createLoading}
            />
            <button
              type="submit"
              disabled={createLoading}
              className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-sky-500/10 flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {createLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Crear CV
            </button>
          </form>

          {/* Separador */}
          <div className="hidden sm:block h-6 w-[1px] bg-slate-850 mx-1" />

          {/* Botón premium de Generar con IA */}
          <button
            onClick={handleAiButtonClick}
            className={`font-bold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-lg transform hover:-translate-y-0.5 ${
              principalCv 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/10 hover:shadow-purple-500/20'
                : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700/60 cursor-pointer'
            }`}
          >
            {principalCv ? (
              <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>Generar con IA</span>
          </button>
        </div>
      </div>

      {userCvs.length === 0 ? (
        <div className="glass-card border border-slate-800 border-dashed rounded-3xl p-12 text-center">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-full text-slate-500 w-fit mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-white mb-1.5">No tienes ningún currículum todavía</h4>
          <p className="text-slate-400 text-xs font-light max-w-sm mx-auto mb-6">
            Escribe un título en el campo superior derecho y presiona &quot;Crear CV&quot; para generar tu primer borrador en Markdown. ¡Se marcará como principal automáticamente!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userCvs.map((cv) => (
            <div
              key={cv.id}
              className={`glass-card p-6 rounded-2xl border transition-all relative overflow-hidden group flex flex-col justify-between ${
                cv.isPrincipal 
                  ? 'border-sky-500/30 bg-sky-950/5 shadow-md shadow-sky-500/5 hover:border-sky-500/40' 
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Decorative glowing accent */}
              <div
                className="absolute top-0 left-0 w-1.5 h-full"
                style={{ backgroundColor: cv.isPrincipal ? '#0ea5e9' : (cv.accentColor || '#1a5f7a') }}
              />

              <div>
                <div className="flex items-start justify-between mb-4 pl-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                        cv.isBase 
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' 
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {cv.isBase ? 'Base' : 'Copia'}
                      </span>
                      
                      {cv.isPrincipal && (
                        <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-0.5 animate-pulse">
                          <Star className="w-2.5 h-2.5 fill-indigo-400" />
                          Principal
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-white text-base leading-snug group-hover:text-sky-400 transition-colors pt-0.5">
                      {cv.title}
                    </h4>
                  </div>

                  {/* Acciones de estrella principal */}
                  <button
                    onClick={() => !cv.isPrincipal && handleMarkAsPrincipal(cv.id)}
                    className={`p-1.5 rounded-lg border transition-all ${
                      cv.isPrincipal
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-md shadow-sky-500/5'
                        : 'bg-slate-900/60 text-slate-500 border-slate-800/80 hover:text-sky-400 hover:border-sky-500/20 opacity-0 group-hover:opacity-100 transition-opacity'
                    }`}
                    title={cv.isPrincipal ? "CV Principal" : "Establecer como Principal"}
                    disabled={cv.isPrincipal || isPending}
                  >
                    <Star className={`w-4 h-4 ${cv.isPrincipal ? 'fill-sky-400 text-sky-400' : ''}`} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-2 text-[11px] font-light text-slate-400 mb-6">
                  <div className="bg-slate-900/60 border border-slate-850 px-2.5 py-1.5 rounded-lg">
                    <span className="block text-[9px] text-slate-500 font-bold uppercase">Plantilla</span>
                    <span className="text-slate-300 font-medium capitalize">{cv.templateName}</span>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-850 px-2.5 py-1.5 rounded-lg">
                    <span className="block text-[9px] text-slate-500 font-bold uppercase">Creado</span>
                    <span className="text-slate-300 font-medium">
                      {new Date(cv.createdAt).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-850 pt-4 pl-2">
                <Link
                  href={`/editor/${cv.id}`}
                  className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1.5 group/link"
                >
                  Editar CV
                  <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
                </Link>

                <button
                  onClick={() => triggerDelete(cv.id)}
                  className="text-slate-500 hover:text-rose-455 p-2 rounded-xl transition-all"
                  title="Borrar Currículum"
                  disabled={isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cajón Lateral / Modal de Optimización por IA */}
      {isAiOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity">
          <div className="w-full max-w-2xl bg-[#070b17] border border-slate-800/80 rounded-2xl max-h-[90vh] p-6 md:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            
            {/* Adornos visuales de fondo */}
            <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-sky-500/5 rounded-full filter blur-3xl pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-indigo-500/5 rounded-full filter blur-3xl pointer-events-none" />

            <div className="flex justify-between items-start mb-6 shrink-0 relative z-10">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-sky-400 animate-pulse" />
                  Optimización Inteligente por IA
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Generaremos un currículum adaptado a partir de tu currículum principal: <strong className="text-sky-400 font-semibold">{principalCv?.title}</strong>.
                </p>
              </div>
              <button
                onClick={() => !aiLoading && setIsAiOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-900 transition-all disabled:opacity-50"
                disabled={aiLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {aiLoading ? (
              /* Loader Premium en Proceso */
              <div className="flex-1 flex flex-col items-center justify-center relative z-10 text-center px-4">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border border-sky-500/20 flex items-center justify-center bg-sky-500/5 shadow-2xl shadow-sky-500/10">
                    <RefreshCw className="w-8 h-8 text-sky-400 animate-spin" />
                  </div>
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-t border-indigo-500 animate-ping opacity-30" />
                </div>
                <h4 className="text-sm font-bold text-white mb-2">Construyendo tu currículum adaptado</h4>
                <p className="text-xs text-slate-400 font-light max-w-sm h-12 flex items-center justify-center animate-pulse">
                  {aiStep}
                </p>
              </div>
            ) : (
              /* Formulario */
              <div className="flex-1 overflow-y-auto pr-1 relative z-10 space-y-4 py-2 scrollbar-custom">
                {aiError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium">
                    {aiError}
                  </div>
                )}

                {!isPremium && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-2xl flex items-start gap-3">
                    <Crown className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">Atención: Plan Gratuito Activo</span>
                      El motor gratuito utiliza **OpenRouter** para el análisis. Los socios PRO disfrutan de la máxima precisión semántica y velocidad de redacción con los modelos oficiales avanzados (DeepSeek / Gemini Pro).
                    </div>
                  </div>
                )}

                <form onSubmit={handleAiOptimize} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        Nombre del Puesto *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.jobTitle}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                        placeholder="Ej. Frontend React Engineer"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        Empresa *
                      </label>
                      <input
                        type="text"
                        required
                        value={aiFormData.company}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, company: e.target.value }))}
                        placeholder="Ej. Stripe"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-slate-400" />
                        Enlace a la Oferta
                      </label>
                      <input
                        type="url"
                        value={aiFormData.url}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, url: e.target.value }))}
                        placeholder="https://..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300">Plataforma</label>
                      <select
                        value={aiFormData.platform}
                        onChange={(e) => setAiFormData(prev => ({ ...prev, platform: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                      >
                        <option value="linkedin">LinkedIn</option>
                        <option value="infojobs">InfoJobs</option>
                        <option value="indeed">Indeed</option>
                        <option value="other">Otra</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                      Modo de Optimización (Prompt)
                    </label>
                    <select
                      value={aiFormData.promptId}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, promptId: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-sky-500 transition-all cursor-pointer"
                    >
                      {availablePrompts.length === 0 ? (
                        <option value="">Por defecto (Estilo Harvard)</option>
                      ) : (
                        availablePrompts.map((prompt) => (
                          <option key={prompt.id} value={prompt.id}>
                            {prompt.name} {prompt.isActive ? '(Predeterminado)' : ''}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      Descripción / Requisitos de la Oferta *
                    </label>
                    <textarea
                      required
                      rows={8}
                      value={aiFormData.jobDescription}
                      onChange={(e) => setAiFormData(prev => ({ ...prev, jobDescription: e.target.value }))}
                      placeholder="Pega aquí la descripción detallada de la oferta, incluyendo las responsabilidades y habilidades requeridas."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all resize-none font-sans"
                    />
                  </div>
                </form>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-900 shrink-0 relative z-10">
              <button
                type="button"
                onClick={() => setIsAiOpen(false)}
                className="px-4 py-2.5 text-sm font-semibold text-slate-450 hover:text-white transition-colors disabled:opacity-50"
                disabled={aiLoading}
              >
                Cerrar
              </button>
              {!aiLoading && (
                <button
                  type="submit"
                  onClick={handleAiOptimize}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 rounded-xl hover:shadow-lg hover:shadow-sky-500/10 transition-all"
                >
                  <Sparkles className="w-4 h-4 animate-pulse" />
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
