import { redirect } from 'next/navigation';
import { isProSubscription } from '@/lib/subscription';
import { getSessionUser } from '@/lib/session';
import Sidebar from '../dashboard/Sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  // Validate admin role
  if (user.role !== 'admin') {
    redirect('/dashboard');
  }

  const isPremium = isProSubscription(user.subscriptionStatus);

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={{ name: user.name, email: user.email, image: user.image, role: user.role }} isPremium={isPremium} />
      <div className="flex-1 min-h-screen relative z-10 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
