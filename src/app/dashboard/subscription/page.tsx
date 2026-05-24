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
    <div className="min-h-screen bg-[#030712] relative overflow-x-hidden">
      {/* Background blurs */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-sky-950/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none" />

      {/* Nav */}
      <nav className="glass-nav sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-sky-400 to-indigo-500 p-2 rounded-xl text-white shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-white">
                NextProf <span className="text-sky-400">AI</span>
              </span>
            </Link>
            <div className="h-5 w-[1px] bg-slate-800 mx-2" />
            <span className="text-slate-400 text-xs font-medium">Suscripción</span>
          </div>

          <div>
            <Link
              href="/dashboard"
              className="text-slate-400 hover:text-white flex items-center gap-1.5 text-xs font-semibold bg-slate-900/80 border border-slate-800 px-3.5 py-2 rounded-xl transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Panel</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        
        {/* HEADER SECTION */}
        <div className="text-center mb-12">
          {isPremium ? (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] uppercase font-bold tracking-wider mb-4 animate-pulse-subtle">
              <Crown className="w-3.5 h-3.5" />
              Socio Pro Activo
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-4">
              <CreditCard className="w-3.5 h-3.5" />
              Plan Gratuito Activo
            </div>
          )}
          
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            {isPremium ? (
              <>Tu Suscripción <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">Pro Ejecutiva</span></>
            ) : (
              <>Elige tu camino al <span className="bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">Éxito Profesional</span></>
            )}
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-3 font-light leading-relaxed max-w-xl mx-auto">
            {isPremium 
              ? "Gestiona los detalles de tu facturación y sigue impulsando tu carrera con el motor semántico de optimización más avanzado." 
              : "Optimiza tu currículum, adapta copias para cada oferta y controla tus procesos de selección. Accede a los motores oficiales Premium."}
          </p>
        </div>

        {/* CONTENIDO PRINCIPAL: CASO FREE */}
        {!isPremium && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mt-8">
            
            {/* CARD PLAN FREE */}
            <div className="glass-card p-8 rounded-3xl border border-slate-800 bg-slate-950/20 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-slate-800/80">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white">Plan Gratuito</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Perfecto para comenzar</p>
                  </div>
                  <span className="text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full">
                    Activo
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">0 €</span>
                  <span className="text-xs text-slate-500 font-light">/ para siempre</span>
                </div>

                <div className="h-[1px] bg-slate-800/60 w-full mb-6" />

                <ul className="space-y-4 text-xs font-light text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>Currículums base ilimitados</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>Plantilla ejecutiva <strong>Harvard</strong></span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>Optimización básica por IA (OpenRouter)</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                    <span>Tablero Kanban completo para seguimiento</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  href="/dashboard"
                  className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-750 font-bold py-3 px-4 rounded-2xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  Ir a mis Currículums
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* CARD PLAN PRO */}
            <div className="glass-card p-8 rounded-3xl border border-amber-500/20 bg-gradient-to-b from-[#070b19] to-slate-950/40 flex flex-col justify-between relative overflow-hidden transition-all duration-300 hover:border-amber-500/35 shadow-xl shadow-amber-500/5 glow-primary">
              {/* Glow decorativo */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

              <div>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                      Socio Pro
                      <Crown className="w-4 h-4 text-amber-400 animate-pulse-subtle" />
                    </h3>
                    <p className="text-xs text-amber-500/70 mt-0.5">Para profesionales serios</p>
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/35 px-2.5 py-0.5 rounded-full">
                    Recomendado
                  </span>
                </div>

                <div className="mb-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-amber-400">10 €</span>
                  <span className="text-xs text-slate-400 font-light">/ mes (IVA inc.)</span>
                </div>

                <div className="h-[1px] bg-slate-850 w-full mb-6" />

                <ul className="space-y-4 text-xs font-light text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Acceso a Motores Oficiales</strong>: DeepSeek y Gemini Pro para máxima calidad en optimizaciones de IA</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>5 Plantillas Premium</strong>: Harvard, Modern, Minimal, Creative y Swiss</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Velocidad de generación prioritaria en segundos</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Vinculación ilimitada de CVs dentro del tablero Kanban</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Soporte prioritario y acceso a mejoras de plantillas</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <a
                  href="/api/stripe/checkout"
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black py-3 px-4 rounded-2xl text-xs transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5"
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
          <div className="max-w-2xl mx-auto mt-6 space-y-8">
            
            {/* TARJETA DE BIENVENIDA Y MOTIVACIÓN */}
            <div className="glass-card p-8 rounded-3xl border border-amber-500/25 bg-gradient-to-br from-[#070b1a] to-slate-950/60 shadow-2xl relative overflow-hidden glow-primary">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full filter blur-2xl pointer-events-none" />
              
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/25 shrink-0">
                  <Crown className="w-6 h-6 animate-pulse-subtle" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">¡Gracias por ser Socio Pro!</h3>
                  <p className="text-xs text-amber-400/80 font-medium">Estás en el camino hacia tu mejor versión profesional.</p>
                </div>
              </div>

              <div className="space-y-4 text-xs font-light text-slate-300 leading-relaxed">
                <p>
                  Tu cuenta dispone de <strong>acceso ejecutivo ilimitado</strong>. Esto significa que estás utilizando los motores oficiales líderes del sector (<strong>DeepSeek y Gemini Pro</strong>) para alinear semánticamente tu perfil con los requisitos específicos que los seleccionadores buscan.
                </p>
                
                <div className="p-4 bg-slate-950/70 border border-slate-850 rounded-2xl mt-4">
                  <span className="font-bold text-white text-xs flex items-center gap-1.5 mb-1">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-400 animate-pulse-subtle" />
                    ¿Sabías qué?
                  </span>
                  <span className="block text-slate-400">
                    Los candidatos que adaptan minuciosamente su currículum para cada oferta específica **multiplican por 3 la tasa de llamadas para entrevistas**. Tu capacidad para generar rápidamente CVs optimizados con IA te otorga una ventaja competitiva excepcional en el mercado laboral actual.
                  </span>
                </div>
              </div>

              <div className="h-[1px] bg-slate-850 w-full my-6" />

              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                <div className="text-left w-full sm:w-auto">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Estado de Facturación</span>
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                    Suscripción activa y al día
                  </span>
                </div>

                <a
                  href="/api/stripe/portal"
                  className="w-full sm:w-auto bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <CreditCard className="w-4 h-4 text-slate-450" />
                  Gestionar Método de Pago & Facturas
                </a>
              </div>
            </div>

            {/* BENEFICIOS ACTIVOS CHECKLIST */}
            <div className="glass-card p-6 rounded-3xl border border-slate-850/80 bg-slate-950/20">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Tus Beneficios Activos</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>IA Oficial</strong> (DeepSeek / Gemini Pro)</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span><strong>5 Plantillas Premium</strong> de CV</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Vinculación ilimitada en Kanban</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
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
