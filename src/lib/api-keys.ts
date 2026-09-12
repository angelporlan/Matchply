import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';

export const USER_API_KEY_PREFIX = 'matchply_usr_';
const SECRET_BYTES = 24;
const PREFIX_SECRET_CHARS = 8;

export function hashUserApiKey(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function userApiKeyPrefix(token: string) {
  if (!token.startsWith(USER_API_KEY_PREFIX)) return null;
  const secret = token.slice(USER_API_KEY_PREFIX.length);
  if (secret.length < PREFIX_SECRET_CHARS) return null;
  return `${USER_API_KEY_PREFIX}${secret.slice(0, PREFIX_SECRET_CHARS)}`;
}

export function issueUserApiKey() {
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const plaintext = `${USER_API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    hash: hashUserApiKey(plaintext),
    prefix: `${USER_API_KEY_PREFIX}${secret.slice(0, PREFIX_SECRET_CHARS)}`,
  };
}

export function isPersonalApiKey(token: string) {
  return token.startsWith(USER_API_KEY_PREFIX) && token.length >= USER_API_KEY_PREFIX.length + 16;
}

function hashesMatch(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

export async function findUserByPersonalApiKey(token: string): Promise<User | null> {
  if (!isPersonalApiKey(token)) return null;

  const digest = hashUserApiKey(token);
  const [byHash] = await db.select().from(users).where(eq(users.apiKeyHash, digest)).limit(1);
  if (byHash && hashesMatch(byHash.apiKeyHash || '', digest)) return byHash;

  const [legacy] = await db.select().from(users).where(eq(users.apiKey, token)).limit(1);
  if (!legacy) return null;

  const prefix = userApiKeyPrefix(token);
  try {
    await db.update(users).set({
      apiKeyHash: digest,
      apiKeyPrefix: prefix,
      apiKey: null,
    }).where(eq(users.id, legacy.id));
  } catch {
    const [migrated] = await db.select().from(users).where(eq(users.apiKeyHash, digest)).limit(1);
    return migrated || legacy;
  }

  return { ...legacy, apiKeyHash: digest, apiKeyPrefix: prefix, apiKey: null };
}
