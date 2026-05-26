import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import Sidebar from './Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session || !session.user || !session.user.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Fetch updated user status
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0b0f19] flex flex-col md:flex-row transition-colors duration-300 text-[#1e1b4b] dark:text-[#f3f4f6] font-sans">
      <Sidebar user={{ name: session.user.name, email: session.user.email, role: dbUser?.role }} isPremium={isPremium} />
      <div className="flex-1 min-h-screen relative overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
