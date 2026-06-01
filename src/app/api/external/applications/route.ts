import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, jobOffers, cvs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { isProSubscription } from '@/lib/subscription';

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

    // A. Comprobar si es una clave de API Personal de usuario
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
      // B. Retrocompatibilidad: Validar con la Clave de API Global
      const expectedGlobalToken = process.env.MATCHPLY_EXTERNAL_API_KEY;

      if (!expectedGlobalToken) {
        console.error('Error: MATCHPLY_EXTERNAL_API_KEY is not defined in environment variables.');
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
      url,
      platform,
      description,
      status,
      source,
      livenessStatus,
      scoreOverall,
      scoreBreakdown,
      tldr,
      redFlags,
      legitimacyTier,
      rawReport,
      cvMarkdownTailored,
      targetProofPoints,
      coverLetter,
      outreachMessage,
      interviewStories,
      nextFollowupDate,
      rejectionPatternTags,
    } = body;

    // Campos obligatorios generales
    if (!title || !company) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required fields: title or company' }),
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
      // Si ya tenemos el usuario por API Key Personal, forzamos su propio email
      userEmail = user!.email;
    }

    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'User resolution failed' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3.5. Enforce PRO/Premium Subscription Check
    const isPremium = isProSubscription(user.subscriptionStatus);
    if (!isPremium) {
      return new NextResponse(
        JSON.stringify({ error: 'Integrations and API synchronization are PRO features. Please upgrade your plan in Matchply.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 4. Crear CV Adaptado en Matchply si se incluye cvMarkdownTailored
    let cvId: string | null = null;
    if (cvMarkdownTailored) {
      try {
        // Encontrar el CV principal o base del usuario para copiar las configuraciones estéticas
        const [baseCv] = await db
          .select()
          .from(cvs)
          .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
          .orderBy(desc(cvs.isPrincipal))
          .limit(1);

        const templateName = baseCv?.templateName || 'harvard';
        const accentColor = baseCv?.accentColor || '#1a5f7a';
        const fontFamily = baseCv?.fontFamily || 'helvetica';
        const pageMargin = baseCv?.pageMargin ?? 36;
        const scale = baseCv?.scale ?? 1.0;

        // Crear una nueva entrada en la tabla cv
        const [newCv] = await db
          .insert(cvs)
          .values({
            userId,
            title: `[Career-Ops] - ${title} (${company})`,
            content: cvMarkdownTailored,
            isBase: false,
            isPrincipal: false,
            templateName,
            accentColor,
            fontFamily,
            pageMargin,
            scale,
          })
          .returning();

        cvId = newCv.id;
        console.log(`Created tailored CV for ${userEmail}: ${cvId}`);
      } catch (cvError) {
        console.error('Error creating tailored CV for application:', cvError);
        // Continuamos incluso si falla la creación del CV, no bloqueamos la candidatura entera
      }
    }

    // 5. Inserción o Actualización Idempotente en la tabla job_offer
    let existingOffer = null;

    if (url) {
      // Buscar por URL y userId
      const [offer] = await db
        .select()
        .from(jobOffers)
        .where(and(eq(jobOffers.userId, userId), eq(jobOffers.url, url)))
        .limit(1);
      existingOffer = offer;
    } else {
      // Buscar por title, company y userId si no hay URL
      const [offer] = await db
        .select()
        .from(jobOffers)
        .where(
          and(
            eq(jobOffers.userId, userId),
            eq(jobOffers.title, title),
            eq(jobOffers.company, company)
          )
        )
        .limit(1);
      existingOffer = offer;
    }

    const jobOfferData: any = {
      title,
      company,
      url: url || null,
      platform: platform || 'other',
      description: description || null,
      status: status || 'interested',
      source: source || 'career-ops',
      livenessStatus: livenessStatus || 'active',
      scoreOverall: scoreOverall !== undefined ? parseFloat(scoreOverall) : null,
      scoreBreakdown: scoreBreakdown || null,
      tldr: tldr || null,
      redFlags: redFlags || null,
      legitimacyTier: legitimacyTier || null,
      rawReport: rawReport || null,
      targetProofPoints: targetProofPoints || null,
      coverLetter: coverLetter || null,
      outreachMessage: outreachMessage || null,
      interviewStories: interviewStories || null,
      nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
      rejectionPatternTags: rejectionPatternTags || null,
      updatedAt: new Date(),
    };

    let offerId = '';
    let actionType = '';

    if (existingOffer) {
      offerId = existingOffer.id;
      actionType = 'job_offer_sync_update';

      // Si se generó un nuevo CV en esta sincronización, lo vinculamos, de lo contrario dejamos el que tenía
      const updateData = { ...jobOfferData };
      if (cvId) {
        updateData.cvId = cvId;
      }

      await db
        .update(jobOffers)
        .set(updateData)
        .where(eq(jobOffers.id, offerId));

      console.log(`Updated job offer for user ${userId}: ${offerId}`);
    } else {
      actionType = 'job_offer_sync_create';
      
      const insertData = {
        ...jobOfferData,
        userId,
        cvId: cvId || null,
      };

      const [newOffer] = await db
        .insert(jobOffers)
        .values(insertData)
        .returning();

      offerId = newOffer.id;
      console.log(`Created new job offer for user ${userId}: ${offerId}`);
    }

    // 6. Registrar log de auditoría
    await createAuditLog(actionType, userId, user.email, {
      offerId,
      title,
      company,
      source: jobOfferData.source,
      hasCv: !!cvId,
    });

    // Revalidar el path del Dashboard para que se reflejen los cambios visuales en el Kanban
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/kanban');

    return new NextResponse(
      JSON.stringify({
        success: true,
        offerId,
        cvId: cvId || existingOffer?.cvId || null,
        message: existingOffer
          ? 'Application updated successfully'
          : 'Application created successfully',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in external applications sync route:', error);
    return new NextResponse(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const dynamic = 'force-dynamic';
