import { cookies } from 'next/headers';
import { db } from '@/db';
import { users, cvs, jobOffers, userCompanies, companyNotes, applicationViews } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isAiPromptsDebugEnabled } from '@/lib/ai-prompts-debug';
import { createHmac } from 'crypto';

export const DEBUG_SIMULATION_COOKIE = 'mp_debug_simulation';
export const SANDBOX_NEW_USER_EMAIL = 'dev-sandbox-newuser@matchply.local';
export const SANDBOX_NEW_USER_NAME = 'Candidato (Simulación)';

export interface SimulationSessionData {
  originalUserId: string;
  sandboxUserId: string;
  createdAt: number;
}

export function isNewUserSimulationEnabled(): boolean {
  return isAiPromptsDebugEnabled();
}

function getSimulationSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-simulation-fallback-secret-matchply';
}

function signSimulationPayload(payload: string): string {
  const hmac = createHmac('sha256', getSimulationSecret()).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${hmac}`;
}

export function verifySimulationPayload(token: string): SimulationSessionData | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, signature] = parts;
  try {
    const payload = Buffer.from(b64, 'base64url').toString('utf8');
    const expected = createHmac('sha256', getSimulationSecret()).update(payload).digest('hex');
    if (signature !== expected) return null;
    return JSON.parse(payload) as SimulationSessionData;
  } catch {
    return null;
  }
}

export function readSimulationSession(): SimulationSessionData | null {
  if (!isNewUserSimulationEnabled()) return null;
  try {
    const token = cookies().get(DEBUG_SIMULATION_COOKIE)?.value;
    if (!token) return null;
    return verifySimulationPayload(token);
  } catch {
    return null;
  }
}

export async function getOrCreateSandboxUser() {
  const [existing] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      subscriptionStatus: users.subscriptionStatus,
    })
    .from(users)
    .where(eq(users.email, SANDBOX_NEW_USER_EMAIL))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [newUser] = await db
    .insert(users)
    .values({
      name: SANDBOX_NEW_USER_NAME,
      email: SANDBOX_NEW_USER_EMAIL,
      role: 'user',
      subscriptionStatus: 'none',
      accountStatus: 'active',
      isGuest: false,
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      subscriptionStatus: users.subscriptionStatus,
    });

  return newUser;
}

export async function resetSandboxUserData(sandboxUserId: string) {
  await Promise.all([
    db.delete(cvs).where(eq(cvs.userId, sandboxUserId)),
    db.delete(jobOffers).where(eq(jobOffers.userId, sandboxUserId)),
    db.delete(userCompanies).where(eq(userCompanies.userId, sandboxUserId)),
    db.delete(companyNotes).where(eq(companyNotes.userId, sandboxUserId)),
    db.delete(applicationViews).where(eq(applicationViews.userId, sandboxUserId)),
  ]);

  await db
    .update(users)
    .set({
      name: SANDBOX_NEW_USER_NAME,
      subscriptionStatus: 'none',
      proGrantedUntil: null,
      proGrantedReason: null,
      careerProfile: null,
      role: 'user',
      accountStatus: 'active',
    })
    .where(eq(users.id, sandboxUserId));
}

export async function startNewUserSimulation(originalUserId: string) {
  if (!isNewUserSimulationEnabled()) {
    throw new Error('Simulation is disabled when AI_PROMPT_DEBUG is not enabled');
  }

  const sandboxUser = await getOrCreateSandboxUser();
  await resetSandboxUserData(sandboxUser.id);

  const sessionData: SimulationSessionData = {
    originalUserId,
    sandboxUserId: sandboxUser.id,
    createdAt: Date.now(),
  };

  const token = signSimulationPayload(JSON.stringify(sessionData));

  cookies().set(DEBUG_SIMULATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600, // 1 hour max
  });

  return { success: true, sandboxUserId: sandboxUser.id };
}

export async function resetSimulationActionHelper() {
  if (!isNewUserSimulationEnabled()) {
    throw new Error('Simulation is disabled when AI_PROMPT_DEBUG is not enabled');
  }

  const session = readSimulationSession();
  if (!session) {
    throw new Error('No active simulation session');
  }

  await resetSandboxUserData(session.sandboxUserId);
  return { success: true };
}

export function stopNewUserSimulation() {
  try {
    cookies().delete(DEBUG_SIMULATION_COOKIE);
  } catch {
    // ignore in RSC
  }
}
