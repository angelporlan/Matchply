import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { cvContent, jobDescription, company } = body;

    if (!cvContent || !jobDescription || !company) {
      return new NextResponse('Missing required fields', { status: 400 });
    }

    // 1. Obtener usuario para comprobar suscripción
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return new NextResponse('User not found', { status: 404 });
    }

    // 2. Obtener el stream de IA
    const aiStream = await AIService.analyzeSTARStream({
      cvMarkdown: cvContent,
      jobDescription: jobDescription,
      company: company,
      userSubscriptionStatus: user.subscriptionStatus,
    });

    const reader = aiStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const responseStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (error: any) {
          console.error("[STAR Analyze API] Stream error:", error);
          const errString = `\n\n[ERROR:${error.message || 'Error analizando datos'}]`;
          controller.enqueue(encoder.encode(errString));
          controller.close();
        }
      },
      cancel() {
        reader.cancel();
      }
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    });
  } catch (error: any) {
    console.error('Error in STAR analyze route:', error);
    return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
