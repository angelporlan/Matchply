import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { cvs, jobOffers, users } from '@/db/schema';
import { AIService } from '@/lib/ai-service';
import { baseCvForAiColumns, curateOfferColumns } from '@/lib/job-offer-queries';
import { formatPromptForClipboard, type AiPromptDebugAction } from '@/lib/ai-prompts-debug';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const enabled =
    process.env.AI_PROMPTS_DEBUG === 'true' ||
    process.env.NEXT_PUBLIC_AI_PROMPTS_DEBUG === 'true';
  return NextResponse.json({ enabled });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return new NextResponse('User not found', { status: 404 });
  }

  try {
    const body = await req.json();
    const action = body?.action as AiPromptDebugAction;
    const data = body?.data || {};

    if (!action) {
      return NextResponse.json({ success: false, error: 'Acción requerida' }, { status: 400 });
    }

    // Hidratar datos de base de datos si faltan o si se especifican offerIds
    if (action === 'curate_offers') {
      const hasOfferIds = Array.isArray(data.offerIds) && data.offerIds.length > 0;
      const missingOffers = !Array.isArray(data.offers) || data.offers.length === 0;

      if (hasOfferIds || missingOffers) {
        const conditions = [eq(jobOffers.userId, userId)];
        if (hasOfferIds) {
          conditions.push(inArray(jobOffers.id, data.offerIds));
        } else {
          conditions.push(eq(jobOffers.status, 'interested'));
        }
        const foundOffers = await db
          .select(curateOfferColumns)
          .from(jobOffers)
          .where(and(...conditions))
          .orderBy(desc(jobOffers.createdAt));
        data.offers = foundOffers;
      }

      if (!data.baseCvMarkdown) {
        const [baseCv] = await db
          .select(baseCvForAiColumns)
          .from(cvs)
          .where(eq(cvs.userId, userId))
          .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt))
          .limit(1);
        data.baseCvMarkdown = baseCv?.content || '';
      }
    }

    if (action === 'outreach') {
      if (data.offerId && (!data.jobDescription || !data.cvContent)) {
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(and(eq(jobOffers.id, data.offerId), eq(jobOffers.userId, userId)))
          .limit(1);
        if (offer) {
          data.jobTitle = data.jobTitle || offer.title;
          data.company = data.company || offer.company;
          data.jobDescription = data.jobDescription || offer.description || '';
        }
      }
      if (!data.cvContent) {
        const [baseCv] = await db
          .select()
          .from(cvs)
          .where(eq(cvs.userId, userId))
          .orderBy(desc(cvs.isBase), desc(cvs.isPrincipal), desc(cvs.createdAt))
          .limit(1);
        data.cvContent = baseCv?.content || '';
      }
    }

    if (action === 'optimize_cv' && !data.baseCvMarkdown && data.cvId) {
      const [cv] = await db
        .select()
        .from(cvs)
        .where(and(eq(cvs.id, data.cvId), eq(cvs.userId, userId)))
        .limit(1);
      data.baseCvMarkdown = cv?.content || '';
    }

    const resolved = await AIService.buildDebugPrompt(action, data, {
      userId: user.id,
      subscriptionStatus: user.subscriptionStatus,
      careerProfile: user.careerProfile,
    });

    const fullPromptText = formatPromptForClipboard({
      actionTitle: resolved.actionTitle,
      provider: resolved.provider,
      model: resolved.model,
      systemPrompt: resolved.systemPrompt,
      userPrompt: resolved.userPrompt,
    });

    return NextResponse.json({
      success: true,
      action,
      actionTitle: resolved.actionTitle,
      provider: resolved.provider,
      model: resolved.model,
      systemPrompt: resolved.systemPrompt,
      userPrompt: resolved.userPrompt,
      fullPromptText,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error al construir el prompt de depuración',
      },
      { status: 500 },
    );
  }
}
