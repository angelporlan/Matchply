import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getAdminStats, getAIConfig } from './actions';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const session = await auth();

  // Validar rol de administrador en el servidor
  if (!session || !session.user || (session.user as any).role !== 'admin') {
    redirect('/dashboard');
  }

  // Obtener datos iniciales para hidratar el cliente
  const statsRes = await getAdminStats();
  const aiConfigRes = await getAIConfig();

  if (!statsRes.success || !aiConfigRes.success) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] text-[#1E1B4B] flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-[#1E1B4B]/10 rounded-[12px] p-8 max-w-md text-center shadow-sm">
          <h2 className="text-xl font-bold font-display text-rose-500 mb-2">Error de Carga</h2>
          <p className="text-[#1E1B4B]/60 text-sm font-light">
            No se han podido cargar los datos de administración de la base de datos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminClient
      initialStats={statsRes.stats!}
      initialUsers={statsRes.users || []}
      initialSettings={aiConfigRes.settings || []}
      initialPrompts={aiConfigRes.prompts || []}
    />
  );
}

export const dynamic = 'force-dynamic';
