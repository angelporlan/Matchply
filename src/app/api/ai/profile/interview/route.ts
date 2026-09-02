import { NextRequest, NextResponse } from 'next/server';
import { getActor } from '@/lib/actor';
import { AIService } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    const actor = await getActor({ allowGuest: true });
    if (!actor) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = await req.json();
    const { action, currentProfile, qaList, sectionType, currentContent, dumpText, optionalTarget, classification } = body || {};

    if (action === 'start_interview' || action === 'generate_questions') {
      const dump = (dumpText || currentProfile?.bio || currentProfile?.masterDocument || '').trim();
      const classification = await AIService.classifyCareerProfile({
        dumpText: dump,
        optionalTarget,
        userSubscriptionStatus: actor.subscriptionStatus,
      });
      const questions = await AIService.generateProfileInterviewQuestions({
        currentProfile: currentProfile || {},
        classification,
        dumpText: dump,
        optionalTarget,
        userSubscriptionStatus: actor.subscriptionStatus,
      });

      return NextResponse.json({
        success: true,
        classification,
        questions,
      });
    }

    if (action === 'synthesize_profile') {
      const dump = (dumpText || currentProfile?.bio || '').trim();
      if ((!qaList || !Array.isArray(qaList) || qaList.length === 0) && !dump) {
        return NextResponse.json({
          success: false,
          error: 'Pega tu experiencia o responde al menos una pregunta.',
        }, { status: 400 });
      }

      const synthesizedProfile = await AIService.synthesizeProfileFromInterview({
        currentProfile: currentProfile || {},
        qaList: Array.isArray(qaList) ? qaList : [],
        dumpText: dump,
        optionalTarget,
        classification: classification || currentProfile?.classification,
        userSubscriptionStatus: actor.subscriptionStatus,
      });

      return NextResponse.json({
        success: true,
        profile: synthesizedProfile,
      });
    }

    if (action === 'polish_section') {
      if (!currentContent || !currentContent.trim()) {
        return NextResponse.json({
          success: false,
          error: 'No se envió texto para pulir.',
        }, { status: 400 });
      }

      const polishedContent = await AIService.polishProfileSection({
        sectionType: sectionType || 'bio',
        currentContent,
        userSubscriptionStatus: actor.subscriptionStatus,
      });

      return NextResponse.json({
        success: true,
        polishedContent,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Acción no reconocida.',
    }, { status: 400 });
  } catch (error: any) {
    console.error('[Profile Interview API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error en el Copiloto de Perfil IA.',
    }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
