import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getAdminStats, getAIConfig, getAdminAuditLogs, getAdminAuditStats } from './actions';
import AdminClient from './AdminClient';

export default async function AdminPage() {
  const user = await getSessionUser();

  // Validar rol de administrador en el servidor (rol fresco de BD, compartido con el layout)
  if (!user || user.role !== 'admin') {
    redirect('/dashboard');
  }

  // Obtener datos iniciales para hidratar el cliente
  const [statsRes, aiConfigRes, auditLogsRes, auditStatsRes] = await Promise.all([
    getAdminStats(),
    getAIConfig(),
    getAdminAuditLogs(),
    getAdminAuditStats(),
  ]);

  if (!statsRes.success || !aiConfigRes.success) {
    return (
      <div className="min-h-screen bg-canvas text-text flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-white border border-subtle rounded-[12px] p-8 max-w-md text-center shadow-sm">
          <h2 className="text-xl font-bold font-display text-rose-500 mb-2">Error de Carga</h2>
          <p className="text-text-muted text-sm font-light">
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
      initialAuditLogs={auditLogsRes.success ? auditLogsRes.logs || [] : []}
      initialAuditStats={auditStatsRes.success ? auditStatsRes.stats! : { registersToday: 0, loginsToday: 0, cvsCreatedToday: 0, downloadsToday: 0 }}
    />
  );
}

export const dynamic = 'force-dynamic';
