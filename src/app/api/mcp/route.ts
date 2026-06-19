import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, jobOffers, cvs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Resolve user from Bearer token in Authorization header */
async function resolveUserFromBearer(req: NextRequest) {
  let token = '';

  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();
  } else {
    // Fallback: extract token from query parameters
    const { searchParams } = new URL(req.url);
    const queryToken = searchParams.get('token');
    if (queryToken) {
      token = queryToken.trim();
    }
  }

  if (!token) return null;

  // User-specific API key
  if (token.startsWith('matchply_usr_')) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.apiKey, token))
      .limit(1);
    return user || null;
  }

  // Global API Key fallback
  const globalToken = process.env.MATCHPLY_EXTERNAL_API_KEY;
  if (globalToken && token === globalToken) {
    // Need an email from a custom header, query param, or fallback
    let email = req.headers.get('x-matchply-user-email');
    if (!email) {
      const { searchParams } = new URL(req.url);
      email = searchParams.get('userEmail');
    }
    if (email) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      return user || null;
    }
  }

  return null;
}

/** CORS headers for ChatGPT compatibility */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };
}

/** Build a JSON-RPC 2.0 success response */
function jsonRpcSuccess(id: any, result: any) {
  return { jsonrpc: '2.0' as const, id, result };
}

/** Build a JSON-RPC 2.0 error response */
function jsonRpcError(id: any, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

// ─────────────────────────────────────────────
// MCP Tool Definitions
// ─────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: 'optimizar_cv',
    description:
      'Optimiza el currículum base del candidato para una oferta de empleo específica de forma automática. Crea la candidatura en el Kanban e inserta el CV adaptado.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del puesto de la oferta de trabajo.' },
        company: { type: 'string', description: 'Nombre de la empresa.' },
        description: { type: 'string', description: 'Descripción detallada o requisitos del puesto.' },
        url: { type: 'string', description: 'URL original del anuncio (opcional).' },
        platform: {
          type: 'string',
          description: 'Plataforma donde se encontró (linkedin, infojobs, indeed, other) (opcional).',
        },
      },
      required: ['title', 'company', 'description'],
    },
  },
  {
    name: 'listar_postulaciones',
    description: 'Obtiene el listado actual de ofertas de trabajo en tu tablero Kanban de Matchply.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['interested', 'applied', 'interview', 'offer', 'rejected'],
          description: 'Filtrar candidaturas por columna/estado (opcional).',
        },
      },
    },
  },
  {
    name: 'crear_postulacion',
    description: 'Añade una nueva postulación de empleo al Kanban manualmente sin optimizar el currículum.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del puesto.' },
        company: { type: 'string', description: 'Nombre de la empresa.' },
        status: {
          type: 'string',
          enum: ['interested', 'applied', 'interview', 'offer', 'rejected'],
          description: 'Columna del Kanban a la que añadir la oferta (por defecto: interested).',
        },
        url: { type: 'string', description: 'Enlace de la oferta (opcional).' },
        platform: { type: 'string', description: 'Plataforma (opcional).' },
        description: { type: 'string', description: 'Detalle de la oferta (opcional).' },
      },
      required: ['title', 'company'],
    },
  },
  {
    name: 'actualizar_estado_postulacion',
    description:
      'Mueve una postulación del Kanban a un nuevo estado (ej. de Interesado a Entrevista o Rechazado).',
    inputSchema: {
      type: 'object',
      properties: {
        offerId: { type: 'string', description: 'El ID de la postulación (UUID).' },
        status: {
          type: 'string',
          enum: ['interested', 'applied', 'interview', 'offer', 'rejected'],
          description: 'Nuevo estado o columna en el tablero Kanban.',
        },
      },
      required: ['offerId', 'status'],
    },
  },
  {
    name: 'buscar_ofertas_remotas',
    description:
      'Busca vacantes activas de programación en tiempo real consultando el feed público de WeWorkRemotely.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Palabra clave a buscar (ej. React, Node, Python, Django).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'evaluar_oferta',
    description:
      'Analiza detalladamente una oferta de trabajo contra tu currículum basándose en tus preferencias y pretensiones configuradas en Matchply. Genera puntuaciones (sobre 100 y desglosadas por dimensiones), palabras clave faltantes y Red Flags.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título del puesto de la oferta de trabajo.' },
        company: { type: 'string', description: 'Nombre de la empresa.' },
        description: { type: 'string', description: 'Descripción de la oferta.' },
        url: { type: 'string', description: 'URL original del anuncio (opcional).' },
        platform: { type: 'string', description: 'Plataforma donde se encontró (linkedin, infojobs, indeed, other) (opcional).' },
      },
      required: ['title', 'company', 'description'],
    },
  },
  {
    name: 'obtener_preferencias_mcp',
    description:
      'Obtiene las preferencias de búsqueda de empleo configuradas por el candidato (pretensiones salariales, años de experiencia, roles objetivo, puntuaciones de ubicación y notas adicionales).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'obtener_cv_base',
    description:
      'Obtiene el contenido en Markdown del currículum base seleccionado del candidato en Matchply (experiencia, habilidades, educación).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ─────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: any,
  userId: string,
  userEmail: string
): Promise<{ content: Array<{ type: string; text: string }> }> {
  switch (toolName) {
    case 'optimizar_cv': {
      const { title, company, description, url, platform } = args;

      if (!title || !company || !description) {
        return {
          content: [{ type: 'text', text: 'Error: Faltan argumentos requeridos: title, company o description.' }],
        };
      }

      const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      // 1. Get base CV (either custom mcpCvId or fallback)
      let baseCv = null;
      if (userRecord?.mcpCvId) {
        [baseCv] = await db
          .select()
          .from(cvs)
          .where(and(eq(cvs.userId, userId), eq(cvs.id, userRecord.mcpCvId)))
          .limit(1);
      }
      if (!baseCv) {
        [baseCv] = await db
          .select()
          .from(cvs)
          .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
          .orderBy(desc(cvs.isPrincipal))
          .limit(1);
      }

      if (!baseCv) {
        return {
          content: [
            {
              type: 'text',
              text: 'No tienes un currículum base subido en Matchply. Sube tu CV base en formato markdown desde la plataforma web antes de optimizar.',
            },
          ],
        };
      }

      // 2. Generate optimized CV with AI
      let cvMarkdownTailored = '';
      try {
        const aiStream = await AIService.optimizeCVStream({
          baseCvMarkdown: baseCv.content,
          jobDescription: description,
          userSubscriptionStatus: userRecord?.subscriptionStatus || 'none',
          candidateName: userRecord?.name || '',
        });

        const reader = aiStream.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          cvMarkdownTailored += decoder.decode(value, { stream: true });
        }
      } catch (err: any) {
        console.error('[MCP Tool optimize] AI generation error:', err);
        return {
          content: [{ type: 'text', text: `Error al generar optimización con IA: ${err.message}` }],
        };
      }

      // 3. Create the tailored CV in DB
      let cvId: string | null = null;
      if (cvMarkdownTailored.trim()) {
        const [newCv] = (await db
          .insert(cvs)
          .values({
            userId,
            title: `Optimizado (MCP) - ${title} (${company})`,
            content: cvMarkdownTailored.trim(),
            isBase: false,
            isPrincipal: false,
            templateName: baseCv.templateName,
            accentColor: baseCv.accentColor,
            fontFamily: baseCv.fontFamily,
            pageMargin: baseCv.pageMargin,
            scale: baseCv.scale,
          })
          .returning()) as any[];
        cvId = newCv.id;
      }

      // 4. Run evaluation with AI
      let scoreOverall: number | null = null;
      let scoreBreakdown: any = null;
      let redFlags: any = null;
      let tldr: string | null = null;
      let legitimacyTier: string | null = null;
      let rawReport: string | null = null;
      let parsedResult: any = null;

      try {
        const evalStream = await AIService.analyzeSTARStream({
          cvMarkdown: baseCv.content,
          jobDescription: description,
          company,
          userSubscriptionStatus: userRecord?.subscriptionStatus || 'none',
          mcpProfile: userRecord?.mcpProfile,
        });

        const evalReader = evalStream.getReader();
        const evalDecoder = new TextDecoder();
        let evalAccumulated = '';
        while (true) {
          const { done, value } = await evalReader.read();
          if (done) break;
          evalAccumulated += evalDecoder.decode(value, { stream: true });
        }

        const cleanJson = evalAccumulated.trim();
        try {
          parsedResult = JSON.parse(cleanJson);
        } catch {
          const jsonBlockRegex = /\{[\s\S]*\}/;
          const match = cleanJson.match(jsonBlockRegex);
          if (match) {
            try {
              parsedResult = JSON.parse(match[0]);
            } catch {}
          }
        }

        if (parsedResult) {
          scoreOverall = parsedResult.score !== undefined ? parseFloat(parsedResult.score.toFixed(1)) : null;
          scoreBreakdown = parsedResult.dimensions ? JSON.stringify(
            parsedResult.dimensions.reduce((acc: any, curr: any) => {
              acc[curr.name] = parseFloat(curr.percentage.toFixed(1));
              return acc;
            }, {})
          ) : null;
          redFlags = parsedResult.redFlags ? JSON.stringify(parsedResult.redFlags) : null;
          tldr = parsedResult.scoreReason || null;
          legitimacyTier = parsedResult.legitimacyTier || null;
          
          // Construct structured markdown sections for rawReport
          rawReport = `## B) Match con CV y Gaps Técnicos\n` +
            `- **Puntuación de compatibilidad:** ${parsedResult.score}/100 (${parsedResult.scoreLabel || 'Analizado'})\n` +
            `- **Razón del score:** ${parsedResult.scoreReason || ''}\n\n` +
            `## C) Análisis de Stack Tecnológico\n` +
            `### Tecnologías coincidentes detectadas:\n` +
            (parsedResult.presentKeywords && parsedResult.presentKeywords.length > 0
              ? parsedResult.presentKeywords.map((k: string) => `- ✓ **${k}**`).join('\n')
              : '- Ninguna detectada') + '\n\n' +
            `### Tecnologías requeridas ausentes (Gaps):\n` +
            (parsedResult.missingKeywords && parsedResult.missingKeywords.length > 0
              ? parsedResult.missingKeywords.map((k: string) => `- ⚠ **${k}**`).join('\n')
              : '- Ninguno detectado') + '\n\n' +
            `## E) Blueprint de Personalización del CV\n` +
            `Veredicto final del Reclutador:\n\n` +
            `${parsedResult.verdict || ''}`;
        }
      } catch (evalErr) {
        console.error('[MCP Tool optimize] AI evaluation error:', evalErr);
      }

      // 5. Upsert job application
      let existingOffer = null;
      if (url) {
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(and(eq(jobOffers.userId, userId), eq(jobOffers.url, url)))
          .limit(1);
        existingOffer = offer;
      } else {
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(and(eq(jobOffers.userId, userId), eq(jobOffers.title, title), eq(jobOffers.company, company)))
          .limit(1);
        existingOffer = offer;
      }

      let offerId = '';
      const offerData: any = {
        title,
        company,
        url: url || null,
        platform: platform || 'other',
        description,
        status: 'interested',
        source: 'mcp_server',
        scoreOverall,
        scoreBreakdown,
        redFlags,
        tldr,
        legitimacyTier,
        rawReport,
        updatedAt: new Date(),
      };

      if (cvId) {
        offerData.cvId = cvId;
      }

      if (existingOffer) {
        offerId = existingOffer.id;
        await db.update(jobOffers).set(offerData).where(eq(jobOffers.id, offerId));
      } else {
        const [newOffer] = (await db.insert(jobOffers).values({ ...offerData, userId }).returning()) as any[];
        offerId = newOffer.id;
      }

      // 6. Audit & revalidate
      await createAuditLog('mcp_cv_optimize', userId, userEmail, { offerId, title, company, cvId });
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/kanban');

      let responseText = `✅ **CV Optimizado con Éxito y Añadido al Kanban**\n\n` +
        `- **Empresa:** ${company}\n` +
        `- **Puesto:** ${title}\n` +
        `- **Estado:** Interesado (Kanban)\n` +
        `- **ID de la Postulación:** \`${offerId}\`\n\n`;

      if (parsedResult) {
        responseText += `🏆 **Puntuación de Match:** **${parsedResult.score}/100**\n` +
          `📌 **Veredicto:** _${parsedResult.scoreReason || parsedResult.verdict || ''}_\n\n`;
        if (Array.isArray(parsedResult.redFlags) && parsedResult.redFlags.length > 0) {
          responseText += `⚠️ **Red Flags:**\n` + parsedResult.redFlags.map((rf: any) => `* **${rf.title}**: _${rf.description}_`).join('\n') + `\n\n`;
        }
      }

      responseText += `El currículum se adaptó correctamente siguiendo tu perfil. Ya está disponible en tu dashboard para previsualizar y exportar a PDF.`;

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    }

    case 'evaluar_oferta': {
      const { title, company, description, url, platform } = args;

      if (!title || !company || !description) {
        return {
          content: [{ type: 'text', text: 'Error: Faltan argumentos requeridos: title, company o description.' }],
        };
      }

      const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      // Resolve base CV
      let baseCv = null;
      if (userRecord?.mcpCvId) {
        [baseCv] = await db
          .select()
          .from(cvs)
          .where(and(eq(cvs.userId, userId), eq(cvs.id, userRecord.mcpCvId)))
          .limit(1);
      }
      if (!baseCv) {
        [baseCv] = await db
          .select()
          .from(cvs)
          .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
          .orderBy(desc(cvs.isPrincipal))
          .limit(1);
      }

      if (!baseCv) {
        return {
          content: [
            {
              type: 'text',
              text: 'No tienes un currículum base subido en Matchply. Sube tu CV base en formato markdown desde la plataforma web antes de evaluar.',
            },
          ],
        };
      }

      // Execute evaluation with AI
      let parsedResult: any = null;
      let evalAccumulated = '';
      try {
        const evalStream = await AIService.analyzeSTARStream({
          cvMarkdown: baseCv.content,
          jobDescription: description,
          company,
          userSubscriptionStatus: userRecord?.subscriptionStatus || 'none',
          mcpProfile: userRecord?.mcpProfile,
        });

        const evalReader = evalStream.getReader();
        const evalDecoder = new TextDecoder();
        while (true) {
          const { done, value } = await evalReader.read();
          if (done) break;
          evalAccumulated += evalDecoder.decode(value, { stream: true });
        }

        const cleanJson = evalAccumulated.trim();
        try {
          parsedResult = JSON.parse(cleanJson);
        } catch {
          const jsonBlockRegex = /\{[\s\S]*\}/;
          const match = cleanJson.match(jsonBlockRegex);
          if (match) {
            try {
              parsedResult = JSON.parse(match[0]);
            } catch {}
          }
        }
      } catch (err: any) {
        console.error('[MCP Tool evaluate] AI generation error:', err);
        return {
          content: [{ type: 'text', text: `Error al evaluar la oferta con IA: ${err.message}` }],
        };
      }

      if (!parsedResult) {
        return {
          content: [{ type: 'text', text: 'Error: El modelo de IA no devolvió una evaluación en formato JSON válido.' }],
        };
      }

      // Map scores and parameters for DB
      const scoreOverall = parsedResult.score !== undefined ? parseFloat(parsedResult.score.toFixed(1)) : null;
      const scoreBreakdown = parsedResult.dimensions ? JSON.stringify(
        parsedResult.dimensions.reduce((acc: any, curr: any) => {
          acc[curr.name] = parseFloat(curr.percentage.toFixed(1));
          return acc;
        }, {})
      ) : null;
      const redFlags = parsedResult.redFlags ? JSON.stringify(parsedResult.redFlags) : null;
      const tldr = parsedResult.scoreReason || null;
      const legitimacyTier = parsedResult.legitimacyTier || null;
      
      // Construct structured markdown sections for rawReport
      const rawReport = `## B) Match con CV y Gaps Técnicos\n` +
        `- **Puntuación de compatibilidad:** ${parsedResult.score}/100 (${parsedResult.scoreLabel || 'Analizado'})\n` +
        `- **Razón del score:** ${parsedResult.scoreReason || ''}\n\n` +
        `## C) Análisis de Stack Tecnológico\n` +
        `### Tecnologías coincidentes detectadas:\n` +
        (parsedResult.presentKeywords && parsedResult.presentKeywords.length > 0
          ? parsedResult.presentKeywords.map((k: string) => `- ✓ **${k}**`).join('\n')
          : '- Ninguna detectada') + '\n\n' +
        `### Tecnologías requeridas ausentes (Gaps):\n` +
        (parsedResult.missingKeywords && parsedResult.missingKeywords.length > 0
          ? parsedResult.missingKeywords.map((k: string) => `- ⚠ **${k}**`).join('\n')
          : '- Ninguno detectado') + '\n\n' +
        `## E) Blueprint de Personalización del CV\n` +
        `Veredicto final del Reclutador:\n\n` +
        `${parsedResult.verdict || ''}`;

      // Upsert job application in DB
      let existingOffer = null;
      if (url) {
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(and(eq(jobOffers.userId, userId), eq(jobOffers.url, url)))
          .limit(1);
        existingOffer = offer;
      } else {
        const [offer] = await db
          .select()
          .from(jobOffers)
          .where(and(eq(jobOffers.userId, userId), eq(jobOffers.title, title), eq(jobOffers.company, company)))
          .limit(1);
        existingOffer = offer;
      }

      const offerData: any = {
        title,
        company,
        url: url || null,
        platform: platform || 'other',
        description,
        status: existingOffer?.status || 'interested',
        source: 'mcp_server',
        scoreOverall,
        scoreBreakdown,
        redFlags,
        tldr,
        legitimacyTier,
        rawReport,
        updatedAt: new Date(),
      };

      let offerId = '';
      if (existingOffer) {
        offerId = existingOffer.id;
        await db.update(jobOffers).set(offerData).where(eq(jobOffers.id, offerId));
      } else {
        const [newOffer] = (await db.insert(jobOffers).values({ ...offerData, userId }).returning()) as any[];
        offerId = newOffer.id;
      }

      // Audit & revalidate
      await createAuditLog('mcp_job_offer_evaluate', userId, userEmail, { offerId, title, company, score: parsedResult.score });
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/kanban');

      // Format clean report for response
      const breakdownText = Array.isArray(parsedResult.dimensions)
        ? '\n' + parsedResult.dimensions.map((d: any) => `- **${d.name}:** ${d.percentage}/100`).join('\n')
        : '';

      const redFlagsText = Array.isArray(parsedResult.redFlags) && parsedResult.redFlags.length > 0
        ? parsedResult.redFlags.map((rf: any) => `⚠️ **${rf.title}**\n  _${rf.description}_`).join('\n')
        : 'Ninguna detectada ✅';

      const keywordsText = Array.isArray(parsedResult.missingKeywords) && parsedResult.missingKeywords.length > 0
        ? parsedResult.missingKeywords.join(', ')
        : 'Ninguna';

      return {
        content: [
          {
            type: 'text',
            text: `🔍 **Evaluación de la Oferta: ${company} — ${title}**\n\n` +
                  `🏆 **Puntuación Global de Match:** **${parsedResult.score}/100**\n` +
                  `📊 **Detalle por Dimensiones (0 - 100):**${breakdownText}\n\n` +
                  `📌 **Resumen / Veredicto:**\n_${tldr || 'No disponible'}_\n\n` +
                  `🚨 **Red Flags Detectadas:**\n${redFlagsText}\n\n` +
                  `🔑 **Palabras Clave Faltantes (ATS):**\n${keywordsText}\n\n` +
                  `📁 **Legitimidad de la Oferta:** \`${legitimacyTier || 'No analizado'}\`\n\n` +
                  `La oferta ha sido añadida a tu Kanban en la columna **"Interesado"** (ID: \`${offerId}\`). Puedes optimizar tu CV para este puesto ejecutando la herramienta de optimización.`,
          },
        ],
      };
    }

    case 'listar_postulaciones': {
      const { status } = args || {};

      const results = await db
        .select()
        .from(jobOffers)
        .where(eq(jobOffers.userId, userId))
        .orderBy(desc(jobOffers.updatedAt));

      const filteredResults = status ? results.filter((o: any) => o.status === status) : results;

      if (filteredResults.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: status
                ? `No tienes postulaciones en el estado "${status}".`
                : 'Aún no has agregado ninguna postulación en Matchply.',
            },
          ],
        };
      }

      const formatted = filteredResults
        .map((o: any) => `* **${o.company}** - ${o.title} (Estado: \`${o.status}\`, Ref: \`${o.id}\`)`)
        .join('\n');

      return {
        content: [{ type: 'text', text: `Aquí tienes tus postulaciones en Matchply:\n\n${formatted}` }],
      };
    }

    case 'crear_postulacion': {
      const { title, company, status, url, platform, description } = args;

      if (!title || !company) {
        return { content: [{ type: 'text', text: 'Error: Faltan argumentos requeridos: title o company.' }] };
      }

      const [newOffer] = (await db
        .insert(jobOffers)
        .values({
          userId,
          title,
          company,
          status: status || 'interested',
          url: url || null,
          platform: platform || 'other',
          description: description || null,
          source: 'mcp_server',
        })
        .returning()) as any[];

      await createAuditLog('mcp_job_offer_create', userId, userEmail, { offerId: newOffer.id, title, company });
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/kanban');

      return {
        content: [
          {
            type: 'text',
            text: `Tarjeta creada correctamente en el Kanban de Matchply.\n- **Empresa:** ${company}\n- **Puesto:** ${title}\n- **Estado:** \`${newOffer.status}\`\n- **ID:** \`${newOffer.id}\``,
          },
        ],
      };
    }

    case 'actualizar_estado_postulacion': {
      const { offerId, status } = args;

      if (!offerId || !status) {
        return { content: [{ type: 'text', text: 'Error: Faltan argumentos requeridos: offerId o status.' }] };
      }

      const [existing] = await db
        .select()
        .from(jobOffers)
        .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
        .limit(1);

      if (!existing) {
        return {
          content: [
            { type: 'text', text: `No se encontró ninguna postulación con el ID \`${offerId}\` asociada a tu cuenta.` },
          ],
        };
      }

      await db.update(jobOffers).set({ status, updatedAt: new Date() }).where(eq(jobOffers.id, offerId));

      await createAuditLog('mcp_job_offer_update_status', userId, userEmail, {
        offerId,
        oldStatus: existing.status,
        newStatus: status,
      });
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/kanban');

      return {
        content: [
          {
            type: 'text',
            text: `Se ha movido la postulación de **${existing.company}** (${existing.title}) al estado \`${status}\` con éxito.`,
          },
        ],
      };
    }

    case 'buscar_ofertas_remotas': {
      const { query } = args;

      if (!query) {
        return { content: [{ type: 'text', text: 'Error: Falta el argumento requerido: query.' }] };
      }

      try {
        const res = await fetch('https://weworkremotely.com/api/v1/jobs', {
          headers: { 'User-Agent': 'MatchplyMCP/1.0' },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch from WWR: ${res.status}`);
        }

        const data = await res.json();
        const jobs = data.jobs || [];

        const queryLower = query.toLowerCase();
        const filtered = jobs
          .filter(
            (job: any) =>
              job.title?.toLowerCase().includes(queryLower) ||
              job.company?.toLowerCase().includes(queryLower) ||
              job.description?.toLowerCase().includes(queryLower)
          )
          .slice(0, 5);

        if (filtered.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No se encontraron ofertas activas para "${query}" en WeWorkRemotely en este momento.`,
              },
            ],
          };
        }

        const jobCards = filtered
          .map((job: any, index: number) => {
            return `${index + 1}. **${job.company}** - **${job.title}**\n   - 📍 Ubicación: ${job.candidate_required_location || 'Remoto a nivel mundial'}\n   - 📂 Categoría: ${job.category}\n   - 🔗 Enlace: [Ver oferta](${job.url})\n   - 📅 Publicado: ${new Date(job.pub_date).toLocaleDateString()}`;
          })
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `🔍 **Ofertas encontradas para "${query}" en WeWorkRemotely:**\n\n${jobCards}\n\n*Consejo: Puedes decirme "Optimiza mi CV para la oferta número X" copiando la descripción de la oferta o indicándome los detalles.*`,
            },
          ],
        };
      } catch (err: any) {
        console.error('[MCP Tool search] error:', err);
        return {
          content: [{ type: 'text', text: `Error al consultar WeWorkRemotely: ${err.message}` }],
        };
      }
    }

    case 'obtener_preferencias_mcp': {
      try {
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!dbUser) {
          return {
            content: [{ type: 'text', text: 'Error: Usuario no encontrado.' }],
          };
        }

        const profile = (dbUser.mcpProfile as any) || {};
        const responseText = `🧠 **Preferencias del Perfil MCP de Matchply**\n\n` +
          `- **Años de Experiencia Real:** ${profile.experienceYears ?? 'No configurado'}\n` +
          `- **Pretensiones Salariales (EUR/año):**\n` +
          `  - Mínimo Aceptable: ${profile.salaryMin ? `${profile.salaryMin} EUR` : 'No configurado'}\n` +
          `  - Salario Objetivo: ${profile.salaryTarget ? `${profile.salaryTarget} EUR` : 'No configurado'}\n` +
          `- **Roles & Tecnologías Objetivo:** ${profile.targetRoles && profile.targetRoles.length > 0 ? profile.targetRoles.join(', ') : 'Ninguno configurado'}\n` +
          `- **Preferencia de Ubicación (1.0 - 5.0):**\n` +
          ((profile.locations && profile.locations.length > 0)
            ? profile.locations.map((loc: any) => `  - ${loc.name}: ${loc.score}`).join('\n')
            : '  - Ninguna configurada') + '\n' +
          `- **Matriz de Ajuste por Experiencia Exigida:**\n` +
          `  - Junior / < 1 año: ${profile.experienceFitRules?.['under-1'] ?? 'No configurada'}\n` +
          `  - Mid / 1-3 años: ${profile.experienceFitRules?.['1-3'] ?? 'No configurada'}\n` +
          `  - Exactamente 4 años: ${profile.experienceFitRules?.['4'] ?? 'No configurada'}\n` +
          `  - Senior / 5+ años: ${profile.experienceFitRules?.['5+'] ?? 'No configurada'}\n` +
          `- **Notas Adicionales de Contexto:** ${profile.additionalNotes || 'Ninguna'}`;

        return {
          content: [{ type: 'text', text: responseText }],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error al obtener preferencias: ${err.message}` }],
        };
      }
    }

    case 'obtener_cv_base': {
      try {
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!dbUser) {
          return {
            content: [{ type: 'text', text: 'Error: Usuario no encontrado.' }],
          };
        }

        let baseCv: any = null;
        if (dbUser.mcpCvId) {
          [baseCv] = await db
            .select()
            .from(cvs)
            .where(and(eq(cvs.userId, userId), eq(cvs.id, dbUser.mcpCvId)))
            .limit(1);
        }
        if (!baseCv) {
          [baseCv] = await db
            .select()
            .from(cvs)
            .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
            .orderBy(desc(cvs.isPrincipal))
            .limit(1);
        }

        if (!baseCv) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tienes un currículum base subido en Matchply. Sube tu CV base en formato markdown desde la plataforma web.',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `📄 **Currículum Base (${baseCv.title}):**\n\n\`\`\`markdown\n${baseCv.content}\n\`\`\``,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: 'text', text: `Error al obtener CV base: ${err.message}` }],
        };
      }
    }

    default:
      return { content: [{ type: 'text', text: `Herramienta no encontrada: ${toolName}` }] };
  }
}

// ─────────────────────────────────────────────
// JSON-RPC Method Router
// ─────────────────────────────────────────────

async function handleJsonRpcRequest(
  body: any,
  userId: string,
  userEmail: string
): Promise<{ response: any; isNotification: boolean }> {
  const { id, method, params } = body;
  const isNotification = id === undefined || id === null;

  console.log(`[MCP Streamable] method=${method} id=${id} user=${userEmail}`, JSON.stringify(params));

  switch (method) {
    case 'initialize': {
      const clientVersion = params?.protocolVersion || '2024-11-05';
      return {
        response: jsonRpcSuccess(id, {
          protocolVersion: clientVersion,
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'Matchply MCP Server',
            version: '1.0.0',
          },
        }),
        isNotification: false,
      };
    }

    case 'notifications/initialized': {
      console.log(`[MCP] Client initialized for user: ${userEmail}`);
      return { response: null, isNotification: true };
    }

    case 'tools/list': {
      return {
        response: jsonRpcSuccess(id, { tools: MCP_TOOLS }),
        isNotification: false,
      };
    }

    case 'tools/call': {
      const { name, arguments: args } = params || {};

      if (!name) {
        return {
          response: jsonRpcError(id, -32602, 'Missing tool name'),
          isNotification: false,
        };
      }

      try {
        const result = await executeTool(name, args || {}, userId, userEmail);
        return {
          response: jsonRpcSuccess(id, result),
          isNotification: false,
        };
      } catch (err: any) {
        console.error(`[MCP] Error executing tool ${name}:`, err);
        return {
          response: jsonRpcError(id, -32603, err.message || 'Internal error during tool execution'),
          isNotification: false,
        };
      }
    }

    case 'ping': {
      return {
        response: jsonRpcSuccess(id, {}),
        isNotification: false,
      };
    }

    default: {
      if (isNotification) {
        // Ignore unknown notifications per MCP spec
        return { response: null, isNotification: true };
      }
      return {
        response: jsonRpcError(id, -32601, `Method not found: ${method}`),
        isNotification: false,
      };
    }
  }
}

// ─────────────────────────────────────────────
// HTTP Handlers (Streamable HTTP Transport)
// ─────────────────────────────────────────────

/**
 * OPTIONS /api/mcp — CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

/**
 * POST /api/mcp — Main JSON-RPC handler
 *
 * ChatGPT sends JSON-RPC requests here. The response is returned
 * synchronously in the HTTP response body (Streamable HTTP).
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate
    const user = await resolveUserFromBearer(req);
    if (!user) {
      return NextResponse.json(
        jsonRpcError(null, -32000, 'Unauthorized: Invalid or missing Bearer token'),
        { status: 401, headers: corsHeaders() }
      );
    }

    // Parse body
    const body = await req.json();

    if (body.jsonrpc !== '2.0') {
      return NextResponse.json(
        jsonRpcError(body.id ?? null, -32600, 'Invalid JSON-RPC version. Expected "2.0".'),
        { status: 400, headers: corsHeaders() }
      );
    }

    // Handle the request
    const { response, isNotification } = await handleJsonRpcRequest(body, user.id, user.email);

    // Notifications get HTTP 202 with no body
    if (isNotification) {
      return new Response(null, { status: 202, headers: corsHeaders() });
    }

    // Regular requests get the JSON-RPC response
    return NextResponse.json(response, {
      status: 200,
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
      },
    });
  } catch (error: any) {
    console.error('[MCP POST] Error:', error);
    return NextResponse.json(
      jsonRpcError(null, -32603, error.message || 'Internal Server Error'),
      { status: 500, headers: corsHeaders() }
    );
  }
}

/**
 * GET /api/mcp — SSE stream for server-initiated notifications (optional)
 *
 * Some MCP clients may open a GET connection to listen for server notifications.
 * We keep it simple with a keep-alive stream.
 */
export async function GET(req: NextRequest) {
  // Authenticate
  const user = await resolveUserFromBearer(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing Bearer token' },
      { status: 401, headers: corsHeaders() }
    );
  }

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial comment to establish the connection
      controller.enqueue(new TextEncoder().encode(': connected\n\n'));

      // Keep-alive every 15s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch {
          clearInterval(keepAlive);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(keepAlive);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * DELETE /api/mcp — Close session (optional)
 */
export async function DELETE() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders(),
  });
}

export const dynamic = 'force-dynamic';
