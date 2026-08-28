import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
import { createAuditLog } from '@/lib/audit';
import { requireUserFeature } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CuratedStreamItem = {
  id: string;
  title: string;
  company: string;
  score: number;
  decision: 'keep' | 'archive';
  fitReason: string;
  highlightSkills?: string[];
};

function encodeLine(payload: unknown) {
  return `${JSON.stringify(payload)}\n`;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let targetThreshold = 65;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.targetThreshold === 'number' && Number.isFinite(body.targetThreshold)) {
      targetThreshold = Math.max(0, Math.min(100, Math.round(body.targetThreshold)));
    }
  } catch {
    // body opcional
  }

  const userId = session.user.id;

  try {
    await requireUserFeature(userId, 'kanban');
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return new NextResponse('User not found', { status: 404 });
  }

  const userCvsList = await db
    .select()
    .from(cvs)
    .where(eq(cvs.userId, userId))
    .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt));

  const baseCv = userCvsList.find((c) => c.isBase || c.isPrincipal) || userCvsList[0];
  const interestedOffers = await db
    .select()
    .from(jobOffers)
    .where(and(eq(jobOffers.userId, userId), eq(jobOffers.status, 'interested')))
    .orderBy(desc(jobOffers.createdAt));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(encodeLine(payload)));
      };

      try {
        if (interestedOffers.length === 0) {
          send({ type: 'done', total: 0, kept: 0, archived: 0, results: [] });
          controller.close();
          return;
        }

        send({
          type: 'start',
          total: interestedOffers.length,
          baseCvName: baseCv?.title || 'CV Principal',
        });

        const allResults: CuratedStreamItem[] = [];
        const userProfile = (user.mcpProfile as any) || {};

        await AIService.curateOffersBatch({
          baseCvMarkdown: baseCv?.content || '',
          userCareerProfile: userProfile,
          offers: interestedOffers.map((o) => ({
            id: o.id,
            title: o.title,
            company: o.company,
            description: o.description,
            platform: o.platform,
            scoreOverall: o.scoreOverall,
            tldr: o.tldr,
            sourceMetadata: o.sourceMetadata,
          })),
          userSubscriptionStatus: user.subscriptionStatus,
          targetThreshold,
          onBatchComplete: async (items) => {
            for (const item of items) {
              allResults.push(item);
              send({ type: 'item', item });

              if (typeof item.score === 'number' && item.score > 0) {
                await db
                  .update(jobOffers)
                  .set({ scoreOverall: item.score, updatedAt: new Date() })
                  .where(and(eq(jobOffers.id, item.id), eq(jobOffers.userId, userId)))
                  .catch(() => {});
              }
            }
          },
        });

        const kept = allResults.filter((r) => r.decision === 'keep').length;
        const archived = allResults.filter((r) => r.decision === 'archive').length;

        await createAuditLog('job_offers_ai_curate_preview', userId, user.email || null, {
          totalEvaluated: interestedOffers.length,
          keptCount: kept,
          archivedCount: archived,
          streamed: true,
        });

        revalidatePath('/dashboard/kanban');

        send({
          type: 'done',
          total: allResults.length,
          kept,
          archived,
          results: allResults,
        });
      } catch (error: any) {
        send({
          type: 'error',
          message: error?.message || 'Failed to curate offers',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
