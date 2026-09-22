import { headers } from 'next/headers';
import { hasProAccess } from '@/lib/subscription';
import Sidebar from '@/app/dashboard/Sidebar';
import AdminNav from '@/components/admin/AdminNav';
import GtmWorkspaceClient from '@/components/gtm/GtmWorkspaceClient';
import { isGtmViewerAvailable, requireGtmPageAccess } from '@/lib/gtm-access';
import { scanGtmWorkspace } from '@/lib/gtm-workspace';

export const dynamic = 'force-dynamic';

export default async function GtmPage() {
  const user = await requireGtmPageAccess();
  const host = headers().get('host');
  if (!isGtmViewerAvailable(host)) return null;
  const snapshot = await scanGtmWorkspace();

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar
        user={{ name: user.name, email: user.email, image: user.image, role: user.role }}
        isPremium={hasProAccess(user)}
      />
      <main className="flex-1 min-w-0 min-h-screen relative z-10 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <header className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted font-display">Herramientas locales</p>
              <h1 className="text-2xl md:text-[2rem] font-semibold font-display text-text">GTM local</h1>
              <p className="text-sm text-text-muted mt-1 max-w-3xl">
                Entregas exportadas por los bots, separadas por ejecución y fecha. Este panel es de solo lectura.
              </p>
            </div>
            <AdminNav showGtm />
          </header>
          <GtmWorkspaceClient initialSnapshot={snapshot} />
        </div>
      </main>
    </div>
  );
}
