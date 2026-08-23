import { createHash, randomBytes } from 'crypto';
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { extensionInstallations, extensionPairingCodes, users } from '@/db/schema';
import { requireUserFeature } from '@/lib/permissions';
import { NextRequest } from 'next/server';

export const EXTENSION_SCOPE = 'linkedin:ingest' as const;
export const PAIRING_CODE_TTL_MS = 10 * 60 * 1000;
export const EXTENSION_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const pairingAttempts = new Map<string, { startedAt: number; count: number }>();
const extensionRequests = new Map<string, { startedAt: number; count: number }>();

export class ExtensionAuthError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'ExtensionAuthError';
  }
}

function hashSecret(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function createPairingCodeValue() {
  const bytes = randomBytes(8);
  return Array.from(bytes, byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

function normalizePairingCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const code = value.replace(/[-\s]/g, '').toUpperCase();
  return /^[A-Z2-9]{8}$/.test(code) ? code : null;
}

function extractBearer(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new ExtensionAuthError(401, 'Missing or malformed extension session');
  }
  const token = header.slice(7).trim();
  if (!token.startsWith('ext_sess_') || token.length < 24) {
    throw new ExtensionAuthError(401, 'Invalid extension session');
  }
  return token;
}

function rateLimit(map: Map<string, { startedAt: number; count: number }>, key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    map.set(key, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= limit) {
    throw new ExtensionAuthError(429, 'Too many extension requests; try again later');
  }
  current.count += 1;
}

export function rateLimitExtensionRequest(key: string) {
  rateLimit(extensionRequests, key, 120, 60_000);
}

export async function createExtensionPairingCode(userId: string) {
  await requireUserFeature(userId, 'linkedinExtension');
  rateLimit(pairingAttempts, userId, 5, 10 * 60_000);

  const code = createPairingCodeValue();
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MS);
  const [created] = await db.insert(extensionPairingCodes).values({
    userId,
    codeHash: hashSecret(code),
    expiresAt,
  }).returning({ id: extensionPairingCodes.id, expiresAt: extensionPairingCodes.expiresAt });

  return { id: created.id, code, expiresAt: created.expiresAt };
}

export async function listExtensionInstallations(userId: string) {
  return db.select({
    id: extensionInstallations.id,
    tokenPrefix: extensionInstallations.tokenPrefix,
    extensionVersion: extensionInstallations.extensionVersion,
    status: extensionInstallations.status,
    lastSeenAt: extensionInstallations.lastSeenAt,
    lastCaptureAt: extensionInstallations.lastCaptureAt,
    expiresAt: extensionInstallations.expiresAt,
    revokedAt: extensionInstallations.revokedAt,
    createdAt: extensionInstallations.createdAt,
  }).from(extensionInstallations)
    .where(eq(extensionInstallations.userId, userId))
    .orderBy(desc(extensionInstallations.createdAt));
}

export async function revokeExtensionInstallation(userId: string, installationId: string) {
  const [updated] = await db.update(extensionInstallations).set({
    status: 'revoked',
    revokedAt: new Date(),
  }).where(and(
    eq(extensionInstallations.id, installationId),
    eq(extensionInstallations.userId, userId),
    eq(extensionInstallations.status, 'active'),
  )).returning({ id: extensionInstallations.id });
  if (!updated) throw new ExtensionAuthError(404, 'Extension installation not found');
  return updated;
}

export async function claimExtensionPairingCode(codeInput: unknown, extensionVersion?: unknown) {
  const code = normalizePairingCode(codeInput);
  if (!code) throw new ExtensionAuthError(400, 'Pairing code is invalid');
  const now = new Date();
  const codeHash = hashSecret(code);
  const token = `ext_sess_${randomBytes(32).toString('hex')}`;
  const expiresAt = new Date(Date.now() + EXTENSION_SESSION_TTL_MS);

  return db.transaction(async tx => {
    const [pairing] = await tx.select().from(extensionPairingCodes).where(and(
      eq(extensionPairingCodes.codeHash, codeHash),
      isNull(extensionPairingCodes.consumedAt),
      gt(extensionPairingCodes.expiresAt, now),
    )).limit(1);
    if (!pairing) throw new ExtensionAuthError(400, 'Pairing code is expired or already used');

    const [consumed] = await tx.update(extensionPairingCodes).set({ consumedAt: now }).where(and(
      eq(extensionPairingCodes.id, pairing.id),
      isNull(extensionPairingCodes.consumedAt),
      gt(extensionPairingCodes.expiresAt, now),
    )).returning({ id: extensionPairingCodes.id, userId: extensionPairingCodes.userId });
    if (!consumed) throw new ExtensionAuthError(400, 'Pairing code is expired or already used');

    const [installation] = await tx.insert(extensionInstallations).values({
      userId: consumed.userId,
      tokenHash: hashSecret(token),
      tokenPrefix: token.slice(0, 18),
      extensionVersion: typeof extensionVersion === 'string' ? extensionVersion.slice(0, 40) : null,
      status: 'active',
      lastSeenAt: now,
      expiresAt,
    }).returning({
      id: extensionInstallations.id,
      userId: extensionInstallations.userId,
      expiresAt: extensionInstallations.expiresAt,
    });

    return { token, installation };
  });
}

export async function resolveExtensionSession(req: NextRequest) {
  const token = extractBearer(req);
  rateLimitExtensionRequest(hashSecret(token).slice(0, 20));
  const now = new Date();
  const [row] = await db.select({
    installation: extensionInstallations,
    user: users,
  }).from(extensionInstallations)
    .innerJoin(users, eq(users.id, extensionInstallations.userId))
    .where(and(
      eq(extensionInstallations.tokenHash, hashSecret(token)),
      eq(extensionInstallations.status, 'active'),
      isNull(extensionInstallations.revokedAt),
      gt(extensionInstallations.expiresAt, now),
    )).limit(1);

  if (!row) {
    throw new ExtensionAuthError(401, 'Extension session is invalid, expired, or revoked');
  }

  await db.update(extensionInstallations).set({ lastSeenAt: now }).where(eq(extensionInstallations.id, row.installation.id));
  return { token, installation: row.installation, user: row.user, scope: EXTENSION_SCOPE };
}

export async function markExtensionCapture(installationId: string) {
  await db.update(extensionInstallations).set({
    lastSeenAt: new Date(),
    lastCaptureAt: new Date(),
  }).where(eq(extensionInstallations.id, installationId));
}

export function publicExtensionInstallation(installation: {
  id: string;
  tokenPrefix: string;
  extensionVersion: string | null;
  status: string;
  lastSeenAt: Date | null;
  lastCaptureAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}) {
  return installation;
}

export function isExpiredExtensionSession(installation: { expiresAt: Date; revokedAt: Date | null }) {
  return Boolean(installation.revokedAt || installation.expiresAt.getTime() <= Date.now());
}
