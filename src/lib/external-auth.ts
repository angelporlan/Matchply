import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';

export class ExternalAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function resolveExternalUser(req: NextRequest, bodyUserEmail?: string) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ExternalAuthError(401, 'Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();
  if (!token) throw new ExternalAuthError(401, 'Missing API key');

  if (token.startsWith('matchply_usr_')) {
    const [user] = await db.select().from(users).where(eq(users.apiKey, token)).limit(1);
    if (!user) throw new ExternalAuthError(401, 'Invalid User API Key');
    return user;
  }

  const globalToken = process.env.MATCHPLY_EXTERNAL_API_KEY;
  if (!globalToken || token !== globalToken) {
    throw new ExternalAuthError(401, 'Invalid API key');
  }

  const url = new URL(req.url);
  const email = bodyUserEmail
    || req.headers.get('x-matchply-user-email')
    || url.searchParams.get('userEmail');
  if (!email) throw new ExternalAuthError(400, 'Missing required field: userEmail');

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new ExternalAuthError(404, `User not found with email: ${email}`);
  return user;
}
