import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, users, jobOffers } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Sparkles, LogOut, LayoutDashboard, Crown } from 'lucide-react';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import { isProSubscription } from '@/lib/subscription';

export default async function KanbanPage() {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

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

  // 3. Obtener todas las ofertas/candidaturas de empleo del usuario
  const offers = await db
    .select()
    .from(jobOffers)
    .where(eq(jobOffers.userId, userId))
    .orderBy(desc(jobOffers.updatedAt));

  return (
    <div className="min-h-screen bg-[#030712] relative">
      {/* Background blur */}
      <div className="absolute top-[-10%] right-[-10%] w-[45%] h-[45%] rounded-full bg-sky-950/20 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-950/15 blur-[120px] pointer-events-none" />

      {/* Main Nav */}
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
            <span className="text-slate-400 text-xs font-medium">Seguimiento</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-semibold bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-xl transition-all"
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Volver al Panel</span>
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
        {/* Banner Premium si no es pro */}
        {!isPremium && (
          <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl glass-card border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Lleva tus postulaciones al siguiente nivel</h4>
                <p className="text-xs text-slate-400 mt-0.5">Desbloquea optimizaciones por IA directas usando modelos DeepSeek o Gemini Oficiales.</p>
              </div>
            </div>
            <a
              href="/api/stripe/checkout"
              className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-md shadow-amber-500/10 text-center flex items-center justify-center gap-1"
            >
              <Crown className="w-3.5 h-3.5" />
              Ser Pro
            </a>
          </div>
        )}

        {/* Tablero Kanban */}
        <KanbanBoard offers={offers} userCvs={userCvs} />
      </main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
