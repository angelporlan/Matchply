import { redirect } from 'next/navigation';
import { hasProAccess } from '@/lib/subscription';
import { getRequestContext } from '@/lib/request-context';
import Sidebar from './Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getRequestContext();
  if (!ctx.effectiveUser) {
    redirect('/login');
  }
  if (ctx.effectiveUser.accountStatus === 'suspended' && !ctx.impersonation) {
    redirect('/account/suspended');
  }

  const user = ctx.effectiveUser;
  const isPremium = hasProAccess(user);

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={{ name: user.name, email: user.email, image: user.image, role: ctx.impersonation ? 'user' : user.role }} isPremium={isPremium} supportMode={Boolean(ctx.impersonation)} />
      <div className="flex-1 min-w-0 min-h-screen relative z-10">
        {children}
      </div>
    </div>
  );
}
