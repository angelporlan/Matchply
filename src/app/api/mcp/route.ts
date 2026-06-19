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
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;

  // Support both "Bearer <token>" and raw token
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : authHeader.trim();

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
    // Need an email from a custom header or the first admin user
    const email = req.headers.get('x-matchply-user-email');
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

      // 1. Get base CV
      const [baseCv] = await db
        .select()
        .from(cvs)
        .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
        .orderBy(desc(cvs.isPrincipal))
        .limit(1);

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

      const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

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
        const [newCv] = await db
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
          .returning();
        cvId = newCv.id;
      }

      // 4. Upsert job application
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
        updatedAt: new Date(),
      };

      if (cvId) {
        offerData.cvId = cvId;
      }

      if (existingOffer) {
        offerId = existingOffer.id;
        await db.update(jobOffers).set(offerData).where(eq(jobOffers.id, offerId));
      } else {
        const [newOffer] = await db.insert(jobOffers).values({ ...offerData, userId }).returning();
        offerId = newOffer.id;
      }

      // 5. Audit & revalidate
      await createAuditLog('mcp_cv_optimize', userId, userEmail, { offerId, title, company, cvId });
      revalidatePath('/dashboard');
      revalidatePath('/dashboard/kanban');

      return {
        content: [
          {
            type: 'text',
            text: `✅ **CV Optimizado con Éxito y Añadido al Kanban**\n\n- **Empresa:** ${company}\n- **Puesto:** ${title}\n- **Estado:** Interesado (Kanban)\n- **ID de la Postulación:** \`${offerId}\`\n\nEl currículum se adaptó correctamente siguiendo tu perfil. Ya está disponible en tu dashboard para previsualizar y exportar a PDF.`,
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

      const [newOffer] = await db
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
        .returning();

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
