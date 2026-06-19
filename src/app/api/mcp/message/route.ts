import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, jobOffers, cvs } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { AIService } from '@/lib/ai-service';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/lib/audit';

function sendSseMessage(controller: ReadableStreamDefaultController, message: any) {
  try {
    const payload = `event: message\ndata: ${JSON.stringify(message)}\n\n`;
    controller.enqueue(new TextEncoder().encode(payload));
  } catch (error) {
    console.error('[MCP] Failed to send SSE message:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId query parameter' }, { status: 400 });
    }

    const session = globalThis.mcpSessions?.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    const body = await req.json();
    const { jsonrpc, id, method, params } = body;

    if (jsonrpc !== '2.0') {
      return NextResponse.json({ error: 'Invalid JSON-RPC version' }, { status: 400 });
    }

    // Process the JSON-RPC request asynchronously and send response via SSE
    processMcpRequest(session, id, method, params);

    // Return 200 OK immediately as the message was accepted for processing
    return new Response(null, { status: 200 });
  } catch (error: any) {
    console.error('[MCP] Error in message handler:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

async function processMcpRequest(
  session: { controller: ReadableStreamDefaultController; userId: string; userEmail: string },
  id: any,
  method: string,
  params: any
) {
  const { controller, userId, userEmail } = session;

  // Helper to send success responses
  const respondSuccess = (result: any) => {
    if (id !== undefined && id !== null) {
      sendSseMessage(controller, { jsonrpc: '2.0', id, result });
    }
  };

  // Helper to send error responses
  const respondError = (code: number, message: string) => {
    if (id !== undefined && id !== null) {
      sendSseMessage(controller, { jsonrpc: '2.0', id, error: { code, message } });
    }
  };

  try {
    switch (method) {
      case 'initialize': {
        respondSuccess({
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'Matchply MCP Server',
            version: '1.0.0'
          }
        });
        break;
      }

      case 'notifications/initialized': {
        // Notification, no response needed
        console.log(`[MCP] Session initialized for user: ${userEmail}`);
        break;
      }

      case 'tools/list': {
        respondSuccess({
          tools: [
            {
              name: 'optimizar_cv',
              description: 'Optimiza el currículum base del candidato para una oferta de empleo específica de forma automática. Crea la candidatura en el Kanban e inserta el CV adaptado.',
              inputSchema: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Título del puesto de la oferta de trabajo.' },
                  company: { type: 'string', description: 'Nombre de la empresa.' },
                  description: { type: 'string', description: 'Descripción detallada o requisitos del puesto.' },
                  url: { type: 'string', description: 'URL original del anuncio (opcional).' },
                  platform: { type: 'string', description: 'Plataforma donde se encontró (linkedin, infojobs, indeed, other) (opcional).' }
                },
                required: ['title', 'company', 'description']
              }
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
                    description: 'Filtrar candidaturas por columna/estado (opcional).'
                  }
                }
              }
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
                    description: 'Columna del Kanban a la que añadir la oferta (por defecto: interested).'
                  },
                  url: { type: 'string', description: 'Enlace de la oferta (opcional).' },
                  platform: { type: 'string', description: 'Plataforma (opcional).' },
                  description: { type: 'string', description: 'Detalle de la oferta (opcional).' }
                },
                required: ['title', 'company']
              }
            },
            {
              name: 'actualizar_estado_postulacion',
              description: 'Mueve una postulación del Kanban a un nuevo estado (ej. de Interesado a Entrevista o Rechazado).',
              inputSchema: {
                type: 'object',
                properties: {
                  offerId: { type: 'string', description: 'El ID de la postulación (UUID).' },
                  status: {
                    type: 'string',
                    enum: ['interested', 'applied', 'interview', 'offer', 'rejected'],
                    description: 'Nuevo estado o columna en el tablero Kanban.'
                  }
                },
                required: ['offerId', 'status']
              }
            },
            {
              name: 'buscar_ofertas_remotas',
              description: 'Busca vacantes activas de programación en tiempo real consultando el feed público de WeWorkRemotely.',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Palabra clave a buscar (ej. React, Node, Python, Django).' }
                },
                required: ['query']
              }
            }
          ]
        });
        break;
      }

      case 'tools/call': {
        const { name, arguments: args } = params;

        if (!name) {
          respondError(-32602, 'Missing tool name');
          return;
        }

        switch (name) {
          case 'optimizar_cv': {
            const { title, company, description, url, platform } = args;

            if (!title || !company || !description) {
              respondError(-32602, 'Missing required arguments: title, company, or description');
              return;
            }

            // 1. Obtener el CV base del usuario
            const [baseCv] = await db
              .select()
              .from(cvs)
              .where(and(eq(cvs.userId, userId), eq(cvs.isBase, true)))
              .orderBy(desc(cvs.isPrincipal))
              .limit(1);

            if (!baseCv) {
              respondSuccess({
                content: [
                  {
                    type: 'text',
                    text: 'No tienes un currículum base subido en Matchply. Sube tu CV base en formato markdown desde la plataforma web antes de optimizar.'
                  }
                ]
              });
              return;
            }

            const [userRecord] = await db
              .select()
              .from(users)
              .where(eq(users.id, userId))
              .limit(1);

            // 2. Generar CV optimizado con IA del lado del servidor
            let cvMarkdownTailored = '';
            try {
              const aiStream = await AIService.optimizeCVStream({
                baseCvMarkdown: baseCv.content,
                jobDescription: description,
                userSubscriptionStatus: userRecord?.subscriptionStatus || 'none',
                candidateName: userRecord?.name || ''
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
              respondError(-32603, `Error al generar optimización con IA: ${err.message}`);
              return;
            }

            // 3. Crear el CV adaptado en la BD
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

            // 4. Inserción o actualización idempotente de la postulación
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

            // 5. Audit Log y revalidación
            await createAuditLog('mcp_cv_optimize', userId, userEmail, {
              offerId,
              title,
              company,
              cvId
            });

            revalidatePath('/dashboard');
            revalidatePath('/dashboard/kanban');

            respondSuccess({
              content: [
                {
                  type: 'text',
                  text: `✅ **CV Optimizado con Éxito y Añadido al Kanban**\n\n- **Empresa:** ${company}\n- **Puesto:** ${title}\n- **Estado:** Interesado (Kanban)\n- **ID de la Postulación:** \`${offerId}\`\n\nEl currículum se adaptó correctamente siguiendo el método STAR y tu perfil. Ya está disponible en tu dashboard para previsualizar y exportar a PDF.`
                }
              ]
            });
            break;
          }

          case 'listar_postulaciones': {
            const { status } = args;

            let queryBuilder = db
              .select()
              .from(jobOffers)
              .where(eq(jobOffers.userId, userId));

            // Si se pasa status, filtrar
            const results = await queryBuilder.orderBy(desc(jobOffers.updatedAt));
            const filteredResults = status
              ? results.filter((o: any) => o.status === status)
              : results;

            if (filteredResults.length === 0) {
              respondSuccess({
                content: [
                  {
                    type: 'text',
                    text: status 
                      ? `No tienes postulaciones en el estado "${status}".`
                      : 'Aún no has agregado ninguna postulación en Matchply.'
                  }
                ]
              });
              return;
            }

            const formatted = filteredResults
              .map((o: any) => `* **${o.company}** - ${o.title} (Estado: \`${o.status}\`, Ref: \`${o.id}\`)`)
              .join('\n');

            respondSuccess({
              content: [
                {
                  type: 'text',
                  text: `Aquí tienes tus postulaciones en Matchply:\n\n${formatted}`
                }
              ]
            });
            break;
          }

          case 'crear_postulacion': {
            const { title, company, status, url, platform, description } = args;

            if (!title || !company) {
              respondError(-32602, 'Missing required arguments: title or company');
              return;
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

            await createAuditLog('mcp_job_offer_create', userId, userEmail, {
              offerId: newOffer.id,
              title,
              company
            });

            revalidatePath('/dashboard');
            revalidatePath('/dashboard/kanban');

            respondSuccess({
              content: [
                {
                  type: 'text',
                  text: `Tarjetas creadas correctamente en el Kanban de Matchply.\n- **Empresa:** ${company}\n- **Puesto:** ${title}\n- **Estado:** \`${newOffer.status}\`\n- **ID:** \`${newOffer.id}\``
                }
              ]
            });
            break;
          }

          case 'actualizar_estado_postulacion': {
            const { offerId, status } = args;

            if (!offerId || !status) {
              respondError(-32602, 'Missing required arguments: offerId or status');
              return;
            }

            // Validar que pertenezca al usuario
            const [existing] = await db
              .select()
              .from(jobOffers)
              .where(and(eq(jobOffers.id, offerId), eq(jobOffers.userId, userId)))
              .limit(1);

            if (!existing) {
              respondSuccess({
                content: [
                  {
                    type: 'text',
                    text: `No se encontró ninguna postulación con el ID \`${offerId}\` asociada a tu cuenta.`
                  }
                ]
              });
              return;
            }

            await db
              .update(jobOffers)
              .set({ status, updatedAt: new Date() })
              .where(eq(jobOffers.id, offerId));

            await createAuditLog('mcp_job_offer_update_status', userId, userEmail, {
              offerId,
              oldStatus: existing.status,
              newStatus: status
            });

            revalidatePath('/dashboard');
            revalidatePath('/dashboard/kanban');

            respondSuccess({
              content: [
                {
                  type: 'text',
                  text: `Se ha movido la postulación de **${existing.company}** (${existing.title}) al estado \`${status}\` con éxito.`
                }
              ]
            });
            break;
          }

          case 'buscar_ofertas_remotas': {
            const { query } = args;

            if (!query) {
              respondError(-32602, 'Missing required argument: query');
              return;
            }

            try {
              const res = await fetch('https://weworkremotely.com/api/v1/jobs', {
                headers: { 'User-Agent': 'MatchplyMCP/1.0' },
                next: { revalidate: 3600 }
              } as any);

              if (!res.ok) {
                throw new Error(`Failed to fetch from WWR: ${res.status}`);
              }

              const data = await res.json();
              const jobs = data.jobs || [];

              const queryLower = query.toLowerCase();
              const filtered = jobs.filter((job: any) =>
                job.title?.toLowerCase().includes(queryLower) ||
                job.company?.toLowerCase().includes(queryLower) ||
                job.description?.toLowerCase().includes(queryLower)
              ).slice(0, 5);

              if (filtered.length === 0) {
                respondSuccess({
                  content: [
                    {
                      type: 'text',
                      text: `No se encontraron ofertas activas para "${query}" en WeWorkRemotely en este momento.`
                    }
                  ]
                });
                return;
              }

              const jobCards = filtered.map((job: any, index: number) => {
                return `${index + 1}. **${job.company}** - **${job.title}**\n   - 📍 Ubicación requerida: ${job.candidate_required_location || 'Remoto a nivel mundial'}\n   - 📂 Categoría: ${job.category}\n   - 🔗 Enlace: [Ver oferta](${job.url})\n   - 📅 Publicado: ${new Date(job.pub_date).toLocaleDateString()}`;
              }).join('\n\n');

              respondSuccess({
                content: [
                  {
                    type: 'text',
                    text: `🔍 **Ofertas encontradas para "${query}" en WeWorkRemotely:**\n\n${jobCards}\n\n*Consejo: Puedes decirme "Optimiza mi CV para la oferta número X" copiando la descripción de la oferta o indicándome los detalles.*`
                  }
                ]
              });
            } catch (err: any) {
              console.error('[MCP Tool search] error:', err);
              respondError(-32603, `Error al consultar WeWorkRemotely: ${err.message}`);
            }
            break;
          }

          default: {
            respondError(-32601, `Tool not found: ${name}`);
            break;
          }
        }
        break;
      }

      default: {
        respondError(-32601, `Method not found: ${method}`);
        break;
      }
    }
  } catch (error: any) {
    console.error(`[MCP] Error processing method ${method}:`, error);
    respondError(-32603, error.message || 'Internal error during request processing');
  }
}

export const dynamic = 'force-dynamic';
