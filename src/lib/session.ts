import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { sessionUserColumns } from '@/lib/job-offer-queries';
import { requestCache } from '@/lib/request-cache';

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  subscriptionStatus: string;
  isGuest: boolean;
};

/** One JWT decode per request, shared by layout, page and nested helpers. */
export const getSession = requestCache(async () => auth());

/**
 * Session + fresh `user` row (subscription, role) resolved once per request.
 * Returns null when there is no session or the user row no longer exists.
 */
export const getSessionUser = requestCache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const [dbUser] = await db
    .select({ ...sessionUserColumns, isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!dbUser) return null;

  return {
    ...dbUser,
    name: dbUser.name ?? session?.user?.name ?? null,
    image: dbUser.image ?? session?.user?.image ?? null,
  };
});
