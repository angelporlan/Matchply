import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, cvs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
// Subscription check removed — extension is available for all users (free + pro)
import { AIService } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    // 1. Validar la cabecera Authorization (Bearer Token)
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing or malformed Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.substring(7); // Extraer token

    let user = null;
    let userId = '';
    let userEmail = '';

    // Comprobar Clave de API Personal de usuario
    if (token.startsWith('matchply_usr_')) {
      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.apiKey, token))
        .limit(1);

      if (!dbUser) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid User API Key' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }

      user = dbUser;
      userId = dbUser.id;
      userEmail = dbUser.email;
    } else {
      // Retrocompatibilidad con la Clave de API Global
      const expectedGlobalToken = process.env.MATCHPLY_EXTERNAL_API_KEY;

      if (!expectedGlobalToken) {
        console.error('Error: MATCHPLY_EXTERNAL_API_KEY is not defined.');
        return new NextResponse(
          JSON.stringify({ error: 'Server integration is not configured' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (token !== expectedGlobalToken) {
        return new NextResponse(
          JSON.stringify({ error: 'Invalid API key' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2. Parsear el cuerpo de la petición
    const body = await req.json();
    const {
      userEmail: bodyUserEmail,
      title,
      company,
      description,
    } = body;

    // Campos obligatorios
    if (!title || !company || !description) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields: title, company, or description' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Resolver usuario si usamos la Clave Global (debe proveer email)
    if (!userId) {
      const emailToLookup = bodyUserEmail;
      
      if (!emailToLookup) {
        return new NextResponse(
          JSON.stringify({ error: 'Missing required field: userEmail' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const [dbUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, emailToLookup))
        .limit(1);

      if (!dbUser) {
        return new NextResponse(
          JSON.stringify({ error: `User not found with email: ${emailToLookup}` }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      user = dbUser;
      userId = dbUser.id;
      userEmail = dbUser.email;
    } else {
      userEmail = user!.email;
    }

    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'User resolution failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Nota: La evaluación está disponible para todos los usuarios.
    // El AIService selecciona automáticamente el modelo de IA según el plan del usuario.

    // 5. Obtener CV Base del usuario
    const [baseCv] = await db
      .select()
      .from(cvs)
      .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
      .orderBy(desc(cvs.isPrincipal))
      .limit(1);

    if (!baseCv) {
      return new NextResponse(
        JSON.stringify({ error: 'Base CV not found. Please upload a CV first.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 6. Ejecutar evaluación con AIService
    const aiStream = await AIService.analyzeSTARStream({
      cvMarkdown: baseCv.content,
      jobDescription: description,
      company: company,
      userSubscriptionStatus: user.subscriptionStatus,
    });

    // Consumir el stream de IA para construir la respuesta completa
    const reader = aiStream.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulatedText += decoder.decode(value, { stream: true });
    }

    // Intentar parsear el JSON de respuesta
    let parsedResult;
    try {
      parsedResult = JSON.parse(accumulatedText.trim());
    } catch (parseError) {
      // Fallback: Si contiene bloques de código tipo ```json ... ``` extraemos el contenido central
      const jsonBlockRegex = /\{[\s\S]*\}/;
      const match = accumulatedText.match(jsonBlockRegex);
      if (match) {
        try {
          parsedResult = JSON.parse(match[0]);
        } catch (subParseError) {
          console.error('Failed to parse matched JSON substring:', match[0], subParseError);
          return new NextResponse(
            JSON.stringify({ error: 'Invalid JSON formatted response from AI model', raw: accumulatedText }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('Failed to parse AI stream response as JSON:', accumulatedText, parseError);
        return new NextResponse(
          JSON.stringify({ error: 'Failed to parse AI response as JSON', raw: accumulatedText }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 7. Registrar log de auditoría
    await createAuditLog('job_offer_evaluate_api', userId, userEmail, {
      title,
      company,
      score: parsedResult.score,
    });

    return new NextResponse(
      JSON.stringify(parsedResult),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in external evaluation route:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const dynamic = 'force-dynamic';
