import { redirect } from 'next/navigation';
import { hasProAccess } from '@/lib/subscription';
import { getDashboardViewer } from '@/lib/session';
import { timed } from '@/lib/logger';
import Sidebar from './Sidebar';
import { NavigationPendingProvider } from '@/components/navigation/NavigationPendingProvider';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await timed('nav_context', { route: '/dashboard/layout' }, () => getDashboardViewer());
  if (!viewer) {
    redirect('/login');
  }
  if (viewer.user.accountStatus === 'suspended' && !viewer.impersonation) {
    redirect('/account/suspended');
  }

  const user = viewer.user;
  const isPremium = hasProAccess(user);

  return (
    <NavigationPendingProvider>
      <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
        <Sidebar
          user={{
            name: viewer.isGuest ? 'Invitado' : user.name,
            email: viewer.isGuest ? null : user.email,
            image: viewer.isGuest ? null : user.image,
            role: viewer.impersonation ? 'user' : user.role,
          }}
          isPremium={isPremium}
          isGuest={viewer.isGuest}
          supportMode={viewer.impersonation}
        />
        <div className="flex-1 min-w-0 min-h-screen relative">
          {children}
        </div>
      </div>
    </NavigationPendingProvider>
  );
}
