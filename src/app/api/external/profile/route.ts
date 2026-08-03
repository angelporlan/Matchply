import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, users } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { ExternalAuthError, resolveExternalUser } from '@/lib/external-auth';

const SCORE_KEYS = ['stack', 'ai', 'seniority', 'workMode', 'devops', 'sector'] as const;

function validateProfile(profile: any) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('Invalid profile');
  if (profile.weights) {
    const total = SCORE_KEYS.reduce((sum, key) => sum + Number(profile.weights[key] || 0), 0);
    if (SCORE_KEYS.some(key => !Number.isFinite(Number(profile.weights[key])) || Number(profile.weights[key]) < 0)) {
      throw new Error('All profile weights must be positive numbers');
    }
    if (Math.abs(total - 100) > 0.001) throw new Error('Profile weights must add up to 100');
  }
  return {
    ...profile,
    schemaVersion: 1,
    profileVersion: new Date().toISOString(),
  };
}

async function selectedBaseCv(user: any) {
  if (user.mcpCvId) {
    const [selected] = await db.select().from(cvs).where(and(
      eq(cvs.id, user.mcpCvId),
      eq(cvs.userId, user.id),
    )).limit(1);
    if (selected) return selected;
  }
  const [fallback] = await db.select().from(cvs).where(and(
    eq(cvs.userId, user.id),
    eq(cvs.isBase, true),
  )).orderBy(desc(cvs.isPrincipal)).limit(1);
  return fallback || null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveExternalUser(req);
    const baseCv = await selectedBaseCv(user);
    return NextResponse.json({
      profile: user.mcpProfile || null,
      baseCv: baseCv ? { id: baseCv.id, title: baseCv.title, content: baseCv.content } : null,
    });
  } catch (error) {
    if (error instanceof ExternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await resolveExternalUser(req, body.userEmail);
    const profile = validateProfile(body.profile);
    await db.update(users).set({ mcpProfile: profile }).where(eq(users.id, user.id));
    await createAuditLog('external_profile_update', user.id, user.email, {
      profileVersion: profile.profileVersion,
    });
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    if (error instanceof ExternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid profile' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
