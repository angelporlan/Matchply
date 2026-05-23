import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, jobOffers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Sparkles, Plus, FileText, Trash2, ArrowRight, Kanban, CreditCard, CheckCircle2, Crown, LogOut } from 'lucide-react';
import { createBaseCv, deleteCv } from './actions';
import { revalidatePath } from 'next/cache';
import { isProSubscription } from '@/lib/subscription';
import { stripe } from '@/lib/stripe';
import { syncStripeSubscription } from '@/lib/stripe-subscription-sync';

// Acción para crear CV rápido
async function handleCreateCv(formData: FormData) {
  'use server';
  const title = formData.get('title') as string;
  const res = await createBaseCv(title);
  if (res.cvId) {
    redirect(`/editor/${res.cvId}`);
  }
}

// Acción para borrar CV rápido
async function handleDeleteCv(formData: FormData) {
  'use server';
  const id = formData.get('id') as string;
  await deleteCv(id);
  revalidatePath('/dashboard');
}

interface DashboardPageProps {
  searchParams?: {
    checkout?: string;
    session_id?: string;
  };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  if (searchParams?.checkout === 'success' && searchParams.session_id) {
    const checkoutSession = await stripe.checkout.sessions.retrieve(searchParams.session_id);
    if (
      checkoutSession.metadata?.userId === userId &&
      typeof checkoutSession.subscription === 'string'
    ) {
      const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription);
      await syncStripeSubscription(subscription);
    }
  }

  // 1. Obtener información actualizada del usuario de la base de datos
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  // 2. Obtener lista de currículums del usuario
  const userCvs = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.createdAt));

  // 3. Contar candidaturas
  const offers = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId));

  const totalOffers = offers.length;
  const interviewOffers = offers.filter(o => o.status === 'interview').length;
  const successfulOffers = offers.filter(o => o.status === 'offer').length;

  return (
    <div className="min-h-screen bg-[#030712] relative">
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-sky-950/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none" />

      {/* Main Dashboard Nav */}
      <nav className="glass-nav sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
            <span className="text-slate-400 text-xs font-medium">Panel General</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/kanban"
              className="text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-all"
            >
              <Kanban className="w-4 h-4" />
              <span>Ver Kanban</span>
            </Link>
            
            <a
              href="/api/auth/signout"
              className="text-slate-400 hover:text-rose-400 p-2 rounded-xl transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="w-4.5 h-4.5" />
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        {/* Banner de Suscripción */}
        <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 p-6 rounded-3xl glass-card border border-slate-800 glow-primary">
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl ${isPremium ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-900 text-slate-400'}`}>
              {isPremium ? <Crown className="w-6 h-6 animate-pulse-subtle" /> : <CreditCard className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Hola, {session.user.name || 'Candidato'}
                {isPremium && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-400">
                    Socio Pro
                  </span>
                )}
              </h2>
              <p className="text-slate-400 text-xs mt-1 font-light leading-relaxed max-w-xl">
                {isPremium
                  ? 'Tienes acceso total e ilimitado a las 5 plantillas premium y optimización de CVs con el motor de IA oficial (DeepSeek o Gemini).'
                  : 'Estás en el Plan Gratuito. El motor de IA gratuito usa OpenRouter. Desbloquea plantillas profesionales e integraciones de IA avanzadas actualizando tu cuenta.'}
              </p>
            </div>
          </div>
          {isPremium ? (
            <a
              href="/api/stripe/portal"
              className="w-full md:w-auto bg-slate-900 border border-slate-700 hover:border-slate-600 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shrink-0 flex items-center justify-center gap-1.5"
            >
              <CreditCard className="w-4 h-4" />
              Gestionar suscripción
            </a>
          ) : (
            <a
              href="/api/stripe/checkout"
              className="w-full md:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md shadow-amber-500/15 shrink-0 flex items-center justify-center gap-1.5"
            >
              <Crown className="w-4 h-4" />
              Actualizar a Pro (10 €/mes)
            </a>
          )}
        </div>

        {/* Panel de Estadísticas Rápidas */}
        {isPremium && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-medium">Postulaciones Activas</span>
                <h3 className="text-3xl font-black text-white mt-1">{totalOffers}</h3>
              </div>
              <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/10">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-medium">En Proceso de Entrevista</span>
                <h3 className="text-3xl font-black text-amber-400 mt-1">{interviewOffers}</h3>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-slate-400 text-xs font-medium">Ofertas Conseguidas 🎉</span>
                <h3 className="text-3xl font-black text-emerald-400 mt-1">{successfulOffers}</h3>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/10">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Sección de Currículums */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Tus Currículums</h3>
              <p className="text-slate-400 text-xs font-light">Crea tu currículum base o diseña copias optimizadas.</p>
            </div>

            {/* Crear nuevo CV rápido */}
            <form action={handleCreateCv} className="flex gap-2 w-full sm:w-auto">
              <input
                type="text"
                name="title"
                required
                placeholder="Nombre del CV..."
                className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 transition-all w-full sm:w-48"
              />
              <button
                type="submit"
                className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-sky-500/10 flex items-center justify-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Crear CV
              </button>
            </form>
          </div>

          {userCvs.length === 0 ? (
            <div className="glass-card border border-slate-800 border-dashed rounded-3xl p-12 text-center">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-full text-slate-500 w-fit mx-auto mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white mb-1.5">No tienes ningún currículum todavía</h4>
              <p className="text-slate-400 text-xs font-light max-w-sm mx-auto mb-6">
                Escribe un título en el campo superior derecho y presiona &quot;Crear CV&quot; para generar tu primer borrador en Markdown.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userCvs.map((cv) => (
                <div
                  key={cv.id}
                  className="glass-card p-6 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-all relative overflow-hidden group"
                >
                  {/* Decorative glowing accent */}
                  <div
                    className="absolute top-0 left-0 w-1.5 h-full"
                    style={{ backgroundColor: cv.accentColor || '#1a5f7a' }}
                  />

                  <div>
                    <div className="flex items-start justify-between mb-4 pl-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                          {cv.isBase ? 'Base principal' : 'Copia personalizada'}
                        </span>
                        <h4 className="font-bold text-white text-base leading-snug group-hover:text-sky-400 transition-colors">
                          {cv.title}
                        </h4>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pl-2 text-[11px] font-light text-slate-400 mb-6">
                      <div className="bg-slate-900/60 border border-slate-850 px-2.5 py-1.5 rounded-lg">
                        <span className="block text-[9px] text-slate-500 font-bold uppercase">Plantilla</span>
                        <span className="text-slate-300 font-medium capitalize">{cv.templateName}</span>
                      </div>
                      <div className="bg-slate-900/60 border border-slate-850 px-2.5 py-1.5 rounded-lg">
                        <span className="block text-[9px] text-slate-500 font-bold uppercase">Creado</span>
                        <span className="text-slate-300 font-medium">
                          {cv.createdAt.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
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

                    <form action={handleDeleteCv}>
                      <input type="hidden" name="id" value={cv.id} />
                      <button
                        type="submit"
                        className="text-slate-500 hover:text-rose-400 p-2 rounded-xl transition-all"
                        title="Borrar Currículum"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
export const dynamic = 'force-dynamic';
