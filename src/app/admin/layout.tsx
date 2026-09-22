import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { hasProAccess } from '@/lib/subscription';
import { getRequestContext } from '@/lib/request-context';
import Sidebar from '../dashboard/Sidebar';
import AdminNav from '@/components/admin/AdminNav';
import { isGtmViewerAvailable } from '@/lib/gtm-access';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getRequestContext();
  if (!ctx.realUser) redirect('/login');
  if (ctx.impersonation) redirect('/dashboard');
  if (ctx.realUser.role !== 'admin' || ctx.realUser.accountStatus !== 'active') {
    redirect('/dashboard');
  }

  const isPremium = hasProAccess(ctx.realUser);
  const showGtm = isGtmViewerAvailable(headers().get('host'));

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={{ name: ctx.realUser.name, email: ctx.realUser.email, image: ctx.realUser.image, role: ctx.realUser.role }} isPremium={isPremium} />
      <div className="flex-1 min-h-screen relative z-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <header className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted font-display">Administración</p>
              <h1 className="text-2xl md:text-[2rem] font-semibold font-display text-text">Panel de soporte</h1>
            </div>
            <AdminNav showGtm={showGtm} />
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
