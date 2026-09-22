import { redirect } from 'next/navigation';
import { hasProAccess } from '@/lib/subscription';
import { getRequestContext } from '@/lib/request-context';
import { timed } from '@/lib/logger';
import Sidebar from './Sidebar';
import { NavigationPendingProvider } from '@/components/navigation/NavigationPendingProvider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await timed('nav_context', { route: '/dashboard/layout' }, () => getRequestContext());
  if (!ctx.effectiveUser) {
    redirect('/login');
  }
  if (ctx.effectiveUser.accountStatus === 'suspended' && !ctx.impersonation) {
    redirect('/account/suspended');
  }

  const user = ctx.effectiveUser;
  const isPremium = hasProAccess(user);

  return (
    <NavigationPendingProvider>
      <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
        <Sidebar user={{ name: user.name, email: user.email, image: user.image, role: ctx.impersonation ? 'user' : user.role }} isPremium={isPremium} supportMode={Boolean(ctx.impersonation)} />
        <div className="flex-1 min-w-0 min-h-screen relative z-10">
          {children}
        </div>
      </div>
    </NavigationPendingProvider>
  );
}
