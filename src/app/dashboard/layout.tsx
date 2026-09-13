import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isProSubscription } from '@/lib/subscription';
import { sessionUserColumns } from '@/lib/job-offer-queries';
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
    .select(sessionUserColumns)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const subscriptionStatus = dbUser?.subscriptionStatus || 'none';
  const isPremium = isProSubscription(subscriptionStatus);

  return (
    <div className="min-h-screen bg-canvas flex flex-col md:flex-row transition-colors duration-300 text-text font-sans">
      <Sidebar user={{ name: dbUser?.name || session.user.name, email: session.user.email, image: dbUser?.image || session.user.image, role: dbUser?.role }} isPremium={isPremium} />
      <div className="flex-1 min-h-screen relative z-10">
        {children}
      </div>
    </div>
  );
}
