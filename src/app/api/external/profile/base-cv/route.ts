import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { cvs, users } from '@/db/schema';
import { createAuditLog } from '@/lib/audit';
import { ExternalAuthError, resolveExternalUser } from '@/lib/external-auth';

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
  )).limit(1);
  return fallback || null;
}

export async function GET(req: NextRequest) {
  try {
    const user = await resolveExternalUser(req);
    const cv = await selectedBaseCv(user);
    const origin = new URL(req.url).origin;
    return NextResponse.json({
      baseCv: cv,
      editorUrl: cv ? `${origin}/editor/${cv.id}` : null,
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
    let cv: any = null;

    if (body.cvId) {
      [cv] = await db.select().from(cvs).where(and(
        eq(cvs.id, body.cvId),
        eq(cvs.userId, user.id),
      )).limit(1);
      if (!cv) return NextResponse.json({ error: 'CV not found' }, { status: 404 });
      const values: Record<string, unknown> = { isBase: true };
      if (typeof body.title === 'string' && body.title.trim()) values.title = body.title.trim();
      if (typeof body.content === 'string' && body.content.trim()) values.content = body.content.trim();
      [cv] = await db.update(cvs).set(values).where(eq(cvs.id, cv.id)).returning();
    } else {
      if (!body.title?.trim() || !body.content?.trim()) {
        return NextResponse.json({ error: 'title and content are required for a new base CV' }, { status: 400 });
      }
      [cv] = await db.insert(cvs).values({
        userId: user.id,
        title: body.title.trim(),
        content: body.content.trim(),
        isBase: true,
        isPrincipal: false,
        templateName: 'harvard',
        accentColor: '#1a5f7a',
        fontFamily: 'helvetica',
        pageMargin: 36,
        scale: 1,
      }).returning();
    }

    if (body.setPrincipal === true) {
      await db.transaction(async tx => {
        await tx.update(cvs).set({ isPrincipal: false }).where(eq(cvs.userId, user.id));
        await tx.update(cvs).set({ isPrincipal: true, isBase: true }).where(eq(cvs.id, cv.id));
      });
      cv.isPrincipal = true;
    }
    await db.update(users).set({ mcpCvId: cv.id }).where(eq(users.id, user.id));
    await createAuditLog('external_base_cv_select', user.id, user.email, {
      cvId: cv.id,
      created: !body.cvId,
      setPrincipal: body.setPrincipal === true,
    });

    const origin = new URL(req.url).origin;
    return NextResponse.json({
      success: true,
      cv,
      editorUrl: `${origin}/editor/${cv.id}`,
    });
  } catch (error) {
    if (error instanceof ExternalAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 400 });
  }
}

export const dynamic = 'force-dynamic';
