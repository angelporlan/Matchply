import { redirect } from 'next/navigation';
import { isProSubscription } from '@/lib/subscription';
import { getSessionUser } from '@/lib/session';
import Sidebar from './Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  const isPremium = isProSubscription(user.subscriptionStatus);

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={{ name: user.name, email: user.email, image: user.image, role: user.role }} isPremium={isPremium} />
      <div className="flex-1 min-w-0 min-h-screen relative z-10">
        {children}
      </div>
    </div>
  );
}
