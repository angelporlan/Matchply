import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { AIService } from '@/lib/ai-service';
import { runWithUsage } from '@/lib/usage';
import { aiRequestId, aiUsageErrorResponse } from '@/lib/ai-usage-http';
import { effectiveSubscriptionStatus } from '@/lib/subscription';
import { log } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { action, currentProfile, qaList, sectionType, currentContent, dumpText, optionalTarget, classification } = body || {};

    if (!['start_interview', 'generate_questions', 'synthesize_profile', 'polish_section'].includes(action)) return NextResponse.json({ error: 'Acción no reconocida.' }, { status: 400 });
    if (action === 'synthesize_profile' && (!Array.isArray(qaList) || !qaList.length) && !(dumpText || currentProfile?.bio || '').trim()) return NextResponse.json({ error: 'Pega tu experiencia o responde al menos una pregunta.' }, { status: 400 });
    if (action === 'polish_section' && (typeof currentContent !== 'string' || !currentContent.trim())) return NextResponse.json({ error: 'No se envió texto para pulir.' }, { status: 400 });
    const { requestId: _requestId, ...input } = body;
    const result = await runWithUsage(actor.userId, { bucket: 'general', action: `profile:${action}`, requestId: aiRequestId(req, body.requestId), input }, async () => {
    if (action === 'start_interview' || action === 'generate_questions') {
      const dump = (dumpText || currentProfile?.bio || currentProfile?.masterDocument || '').trim();
      const classification = await AIService.classifyCareerProfile({
        dumpText: dump,
        optionalTarget,
        userSubscriptionStatus: effectiveSubscriptionStatus(actor),
      });
      const questions = await AIService.generateProfileInterviewQuestions({
        currentProfile: currentProfile || {},
        classification,
        dumpText: dump,
        optionalTarget,
        userSubscriptionStatus: effectiveSubscriptionStatus(actor),
      });

      return { success: true, classification, questions };
    }

    if (action === 'synthesize_profile') {
      const dump = (dumpText || currentProfile?.bio || '').trim();
      const synthesizedProfile = await AIService.synthesizeProfileFromInterview({
        currentProfile: currentProfile || {},
        qaList: Array.isArray(qaList) ? qaList : [],
        dumpText: dump,
        optionalTarget,
        classification: classification || currentProfile?.classification,
        userSubscriptionStatus: effectiveSubscriptionStatus(actor),
      });

      return { success: true, profile: synthesizedProfile };
    }

    if (action === 'polish_section') {
      const polishedContent = await AIService.polishProfileSection({
        sectionType: sectionType || 'bio',
        currentContent,
        userSubscriptionStatus: effectiveSubscriptionStatus(actor),
      });

      return { success: true, polishedContent };
    }

    throw new Error('UNKNOWN_PROFILE_ACTION');
    });
    return NextResponse.json(result);
  } catch (error: any) {
    const response = aiUsageErrorResponse(error); if (response) return response;
    log({ event: 'profile_interview_failed', level: 'error', error });
    return NextResponse.json({
      success: false,
      error: error.message || 'Error en el Copiloto de Perfil IA.',
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
