import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import { Sparkles, Crown, CreditCard, ArrowLeft, CheckCircle2, Lock, ArrowRight, ShieldCheck, Zap, Lightbulb } from 'lucide-react';

export default async function SubscriptionPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Obtener información del usuario
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  return (
    <div className="relative overflow-x-hidden min-h-screen">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-12">
          {isPremium ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] uppercase font-bold tracking-wider mb-4 animate-pulse-subtle font-display">
              <Crown className="w-3.5 h-3.5 stroke-[1.75]" />
              Socio Pro Activo
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 text-[#1e1b4b]/70 dark:text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-4 shadow-sm font-display">
              <CreditCard className="w-3.5 h-3.5 stroke-[1.75]" />
              Plan Gratuito Activo
            </div>
          )}
          
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#1e1b4b] dark:text-white font-display">
            {isPremium ? (
              <>Tu Suscripción <span className="bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">Pro Ejecutiva</span></>
            ) : (
              <>Elige tu camino al <span className="bg-gradient-to-r from-[#8b5cf6] to-[#1e1b4b] dark:to-indigo-300 bg-clip-text text-transparent">Éxito Profesional</span></>
            )}
          </h1>
          <p className="text-[#1e1b4b]/60 dark:text-slate-400 text-xs md:text-sm mt-3 font-light leading-relaxed max-w-xl mx-auto font-sans">
            {isPremium 
              ? "Gestiona los detalles de tu facturación y sigue impulsando tu carrera con el motor semántico de optimización más avanzado." 
              : "Optimiza tu currículum, adapta copias para cada oferta y controla tus procesos de selección. Accede a los motores oficiales Premium."}
          </p>
        </div>

        {/* CONTENIDO PRINCIPAL: CASO FREE */}
        {!isPremium && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mt-8 animate-fadeIn">
            
            {/* CARD PLAN FREE */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 shadow-sm">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white">Plan Gratuito</h3>
                    <p className="text-xs text-[#1e1b4b]/40 dark:text-slate-500 mt-0.5 font-sans">Perfecto para comenzar</p>
                  </div>
                  <span className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/10 dark:border-white/10 px-3 py-1 rounded-full font-display">
                    Activo
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black font-display text-[#1e1b4b] dark:text-white">0 €</span>
                  <span className="text-xs text-[#1e1b4b]/40 dark:text-slate-500 font-light">/ para siempre</span>
                </div>

                <div className="h-[1px] bg-[#1e1b4b]/10 dark:bg-white/5 w-full mb-6" />

                <ul className="space-y-4 text-xs font-light text-[#1e1b4b]/80 dark:text-slate-200 font-sans">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Currículums base ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Plantilla ejecutiva <strong>Harvard</strong></span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Optimización básica por IA (OpenRouter)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Tablero Kanban completo para seguimiento</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 font-display">
                <Link
                  href="/dashboard"
                  className="w-full bg-white dark:bg-[#1f2937] text-[#1e1b4b] dark:text-slate-200 border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 font-semibold py-3 px-4 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  Ir a mis Currículums
                  <ArrowRight className="w-3.5 h-3.5 stroke-[1.75]" />
                </Link>
              </div>
            </div>

            {/* CARD PLAN PRO */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/30 relative flex flex-col justify-between shadow-md shadow-[#8b5cf6]/5 transition-all duration-300">
              {/* Glow decorativo */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold font-display text-[#1e1b4b] dark:text-white flex items-center gap-1.5">
                      Socio Pro
                      <Crown className="w-4 h-4 text-amber-500 animate-pulse-subtle stroke-[1.75]" />
                    </h3>
                    <p className="text-xs text-amber-600 dark:text-amber-500/70 mt-0.5 font-sans">Para profesionales serios</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/35 px-2.5 py-0.5 rounded-full font-display">
                    Recomendado
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black font-display text-[#1e1b4b] dark:text-white">10 €</span>
                  <span className="text-xs text-[#1e1b4b]/50 dark:text-slate-400 font-light">/ mes (IVA inc.)</span>
                </div>

                <div className="h-[1px] bg-[#1e1b4b]/10 dark:bg-white/5 w-full mb-6" />

                <ul className="space-y-4 text-xs font-light text-[#1e1b4b]/80 dark:text-slate-200 font-sans">
                  <li className="flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 stroke-[1.75]" />
                    <span><strong>Acceso a Motores Oficiales</strong>: DeepSeek y Gemini Pro para máxima calidad en optimizaciones de IA</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span><strong>5 Plantillas Premium</strong>: Harvard, Modern, Minimal, Creative y Swiss</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Velocidad de generación prioritaria en segundos</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Vinculación ilimitada de CVs dentro del tablero Kanban</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#2ecc71] shrink-0 mt-0.5 stroke-[1.75]" />
                    <span>Soporte prioritario y acceso a mejoras de plantillas</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 font-display">
                <a
                  href="/api/stripe/checkout"
                  className="w-full bg-[#1e1b4b] hover:bg-[#1e1b4b]/90 text-white text-center font-bold py-3 px-4 rounded-[8px] text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Crown className="w-3.5 h-3.5" />
                  Actualizar a Socio Pro (10 €/mes)
                </a>
              </div>
            </div>

          </div>
        )}

        {/* CONTENIDO PRINCIPAL: CASO PRO */}
        {isPremium && (
          <div className="max-w-2xl mx-auto mt-6 space-y-8 animate-fadeIn">
            
            {/* TARJETA DE BIENVENIDA Y MOTIVACIÓN */}
            <div className="bg-white dark:bg-[#1f2937] p-8 rounded-[12px] border border-[#8b5cf6]/20 shadow-md shadow-[#8b5cf6]/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#8b5cf6]/3 dark:bg-[#8b5cf6]/5 rounded-full filter blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/25 shrink-0">
                  <Crown className="w-6 h-6 animate-pulse-subtle stroke-[1.75]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display text-[#1e1b4b] dark:text-white">¡Gracias por ser Socio Pro!</h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium font-sans">Estás en el camino hacia tu mejor versión profesional.</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-light text-[#1e1b4b]/80 dark:text-slate-300 leading-relaxed font-sans">
                <p>
                  Tu cuenta dispone de <strong>acceso ejecutivo ilimitado</strong>. Esto significa que estás utilizando los motores oficiales líderes del sector (<strong>DeepSeek y Gemini Pro</strong>) para alinear semánticamente tu perfil con los requisitos específicos que los seleccionadores buscan.
                </p>
                
                <div className="p-4 bg-[#fafafa] dark:bg-[#0b0f19] border border-[#1e1b4b]/5 dark:border-white/5 rounded-[12px] mt-4">
                  <span className="font-bold text-[#1e1b4b] dark:text-white text-xs flex items-center gap-1.5 mb-1 font-display">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 animate-pulse-subtle stroke-[1.75]" />
                    ¿Sabías qué?
                  </span>
                  <span className="block text-[#1e1b4b]/60 dark:text-slate-400 leading-relaxed">
                    Los candidatos que adaptan minuciosamente su currículum para cada oferta específica **multiplican por 3 la tasa de llamadas para entrevistas**. Tu capacidad para generar rápidamente CVs optimizados con IA te otorga una ventaja competitiva excepcional en el mercado laboral actual.
                  </span>
                </div>
              </div>

              <div className="h-[1px] bg-[#1e1b4b]/10 dark:bg-white/5 w-full my-6" />

              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center font-display">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-[10px] text-[#1e1b4b]/40 dark:text-slate-500 font-bold uppercase tracking-wider block">Estado de Facturación</span>
                  <span className="text-xs text-[#2ecc71] font-medium flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-4 h-4 stroke-[1.75]" />
                    Suscripción activa y al día
                  </span>
                </div>

                <a
                  href="/api/stripe/portal"
                  className="w-full sm:w-auto bg-white dark:bg-[#1f2937] border border-[#1e1b4b]/10 dark:border-white/10 hover:bg-[#fafafa] dark:hover:bg-[#1f2937]/80 text-[#1e1b4b] dark:text-slate-200 font-bold py-2.5 px-5 rounded-[8px] text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CreditCard className="w-4 h-4 text-[#1e1b4b]/60 dark:text-slate-400 stroke-[1.75]" />
                  Gestionar Método de Pago & Facturas
                </a>
              </div>
            </div>

            {/* BENEFICIOS ACTIVOS CHECKLIST */}
            <div className="bg-white dark:bg-[#1f2937] p-6 rounded-[12px] border border-[#1e1b4b]/10 dark:border-white/5 shadow-sm">
              <h4 className="text-xs font-bold text-[#1e1b4b]/60 dark:text-slate-400 uppercase tracking-wider mb-4 font-display">Tus Beneficios Activos</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span><strong>IA Oficial</strong> (DeepSeek / Gemini Pro)</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span><strong>5 Plantillas Premium</strong> de CV</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Vinculación ilimitada en Kanban</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-[#1e1b4b]/80 dark:text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 stroke-[1.75]" />
                  <span>Descargas e impresión PDF sin límites</span>
                </div>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
