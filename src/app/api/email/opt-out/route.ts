import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ACTIVATION_EMAIL_OPT_OUT, verifyActivationOptOut } from '@/lib/activation-email';
import { recordActivationEmailAudit } from '@/lib/activation-email-load';
import { getServerTranslations } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { t } = getServerTranslations();
  const url = new URL(request.url);
  const userId = url.searchParams.get('user') || '';
  const token = url.searchParams.get('token') || '';
  const secret = process.env.NEXTAUTH_SECRET || '';
  if (!verifyActivationOptOut(userId, token, secret)) {
    return new NextResponse(t('emails.activation.optOutInvalid'), {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const [user] = await db
    .select({ id: users.id, email: users.email, isGuest: users.isGuest })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.isGuest) {
    return new NextResponse(t('emails.activation.optOutInvalid'), {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  await recordActivationEmailAudit({
    action: ACTIVATION_EMAIL_OPT_OUT,
    userId: user.id,
    email: user.email,
  });
  return new NextResponse(t('emails.activation.optedOut'), {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
