import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { GUEST_COOKIE_NAME } from '@/lib/actor';
import { coldRegisterDestination } from '@/lib/try-entry';
import RegisterForm from './RegisterForm';

export default async function RegisterPage() {
  const session = await auth();
  const guestCookie = cookies().get(GUEST_COOKIE_NAME)?.value;
  const destination = coldRegisterDestination({
    hasSession: Boolean(session?.user),
    hasGuestCookie: Boolean(guestCookie),
  });
  if (destination) redirect(destination);
  return <RegisterForm />;
}

export const dynamic = 'force-dynamic';
