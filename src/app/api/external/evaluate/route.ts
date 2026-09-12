import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { enqueueAiJob } from '@/lib/ai-jobs/queue';
import { findUserByPersonalApiKey } from '@/lib/api-keys';
import { settleAiJob } from '@/lib/ai-jobs/settle';

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
      const dbUser = await findUserByPersonalApiKey(token);

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

    const job = await enqueueAiJob({
      userId,
      kind: 'evaluate',
      payload: { title, company, description },
    });
    const settled = await settleAiJob(job.id);

    if (settled.status === 'failed') {
      return new NextResponse(
        JSON.stringify({ error: settled.lastError || 'Evaluation failed', jobId: settled.id }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (settled.status !== 'completed') {
      return new NextResponse(
        JSON.stringify({
          status: settled.status,
          jobId: settled.id,
          message: 'Evaluation is still running. Poll GET /api/ai/jobs/' + settled.id,
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const parsedResult = (settled.result as { parsed?: unknown } | null)?.parsed;
    if (!parsedResult) {
      return new NextResponse(
        JSON.stringify({ error: 'Evaluation completed without a result', jobId: settled.id }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

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
