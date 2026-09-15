import { db } from '@/db';
import { prompts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAiSetting } from '@/lib/ai-settings';
import { AI_FETCH_TIMEOUT_MS, AI_STREAM_CONNECT_TIMEOUT_MS, fetchWithTimeout } from '@/lib/http';
import {
  DEFAULT_FREE_PROVIDER,
  DEFAULT_FREE_MODEL,
  DEFAULT_PRO_PROVIDER,
  DEFAULT_PRO_MODEL,
  getDefaultModelForProvider
} from './models';
import { canAccessFeature } from './subscription';
import { getBuiltInPrompt, type BuiltInPromptKey } from './prompt-defaults';
import { parseMatchConstraints } from './curation-constraints';
import { log } from './logger';
import {
  buildCandidateCard,
  buildCandidateEvidence,
  buildMatchExplanationPrompt,
  normalizeMatchDetails,
  isMatchDetails,
  isMatchEvidenceSnapshot,
  matchSourceHash,
  MATCH_PROMPT_VERSION,
  MatchValidationError,
  buildMatchSystemPrompt,
  buildMatchUserPrompt,
  buildOfferCard,
  cachedMatchItem,
  canReuseCachedMatch,
  isCanonicalMatchBreakdown,
  matchInputHash,
  normalizeMatchItem,
  type CuratedMatchItem,
  type MatchKind,
} from './matching';

import {
  genericSoftwareInterviewQuestions,
  heuristicClassifyCareerProfile,
  normalizeClassification,
  type InterviewQuestion,
  type ProfileClassification,
} from './profile-classification';
import { hydrateStructuredProfile } from './career-profile';
import type { AiPromptDebugAction } from './ai-prompts-debug';

type CurationOfferInput = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  platform: string;
  scoreOverall?: number | null;
  scoreBreakdown?: unknown;
  tldr?: string | null;
  sourceMetadata?: unknown;
  matchInputHash?: string | null;
  matchEvidence?: unknown;
  matchDetails?: unknown;
};


const MARKDOWN_STRUCTURE_INSTRUCTIONS = `
¡REGLA DE ESTRUCTURA Y FORMATO CRÍTICA PARA EL RENDERIZADO DE PDF!:
Debes devolver el currículum formateado estrictamente bajo las siguientes especificaciones de Markdown para que el motor de PDF pueda parsearlo e imprimirlo correctamente. De lo contrario, se romperá el diseño visual del PDF.

1. NOMBRE DEL CANDIDATO (LA PRIMERÍSIMA LÍNEA DEL DOCUMENTO):
   - La primera línea del documento DEBE ser siempre un título de primer nivel ('# ') con el nombre completo del candidato.
   - Ejemplo exacto:
     # ALEJANDRO MARTÍNEZ
   - Debe haber obligatoriamente una línea en blanco después del nombre.

2. ENCABEZADO DE CONTACTO (Inmediatamente después del nombre y antes de cualquier sección '##'):
   - Las líneas de contacto deben estar en una o dos líneas al principio, formateadas usando el separador ' | ' y negrita para los nombres de los campos.
   - Ejemplo exacto:
     **Email:** alejandro.martinez@ejemplo.com | **Teléfono:** +34 600 00 00 00 | **Ubicación:** Madrid, España
     **LinkedIn:** linkedin.com/in/alejandro-martinez | **GitHub:** github.com/alejandro-martinez | **Web:** alejandromartinez.dev

3. SECCIONES PRINCIPALES:
   - Deben empezar siempre con '## ' (ejemplo: ## Experiencia Profesional, ## Educación, ## Habilidades Técnicas, ## Perfil Profesional).

4. ENTRADAS DE EXPERIENCIA, EDUCACIÓN O PROYECTOS (ESTRUCTURA OBLIGATORIA EN DOS LÍNEAS):
   - Cada puesto de trabajo, titulación académica o proyecto DEBE estar estructurado en exactamente DOS líneas consecutivas e independientes (sin líneas en blanco entre ellas):
     - LÍNEA 1 (Título/Puesto): Debe comenzar exactamente con '### ' seguido ÚNICAMENTE del nombre del puesto o título (ejemplo: ### Desarrollador Full Stack). NO incluyas nombres de empresas, de instituciones, fechas, separadores '|' ni formato adicional en la línea que empieza por '### '.
     - LÍNEA 2 (Empresa y Fecha - Línea inmediatamente posterior): Debe contener el nombre de la Empresa o Institución en negrita, seguido exactamente del separador ' | ' (espacio, barra vertical, espacio), seguido del rango de fechas en cursiva.
       Ejemplo exacto:
       ### Desarrollador Full Stack
       **Tech Solutions Inc.** | *Enero 2024 – Presente*
       
       Ejemplo exacto:
       ### Grado en Ingeniería Informática
       **Universidad Tecnológica** | *2020 – 2024*

   ¡NUNCA mezcles el puesto/título y la empresa/fecha en la misma línea del '### '! Deben estar estrictamente en líneas separadas.

5. SECCIÓN DE HABILIDADES:
   - El título de la sección debe contener la palabra 'habilidades' o 'skills' (ejemplo: ## Habilidades Técnicas).
   - Los elementos dentro de esta sección deben presentarse como viñetas con '-' (o líneas simples) con la categoría en negrita seguida de dos puntos (':') y la lista de tecnologías.
   - Ejemplo exacto:
     - **Backend & APIs:** Node.js, Express, TypeScript, REST APIs
     - **Frontend:** Angular, Astro, Tailwind CSS, HTML5, CSS3

¡REGLA DE ENTREGA SUPERESTRICTA!: Devuelve única y exclusivamente el contenido del currículum optimizado en formato Markdown (.MD). No incluyas explicaciones, preámbulos, comentarios iniciales ni finales, ni envuelvas tu respuesta en bloques de código triple acento grave (\`\`\`markdown o \`\`\`). Tu respuesta completa debe ser directamente el currículum parseable.
`;

const CV_HONESTY_INSTRUCTIONS = `
REGLAS DE FIDELIDAD DEL CV:
- No inventes experiencia, tecnologías, responsabilidades, empresas, fechas, logros ni métricas.
- No conviertas conocimiento adyacente en experiencia directa. Conserva claramente el nivel de evidencia del CV base.
- Mantén todos los logros relevantes existentes y evita lenguaje genérico o clichés propios de textos generados por IA.
- Reescribe como máximo 6 viñetas del CV completo. El resto debe conservarse sustancialmente igual.
- Si una palabra clave de la oferta no está respaldada por el CV base, no la añadas como habilidad o experiencia.
`;


export interface OptimizeRequest {
  baseCvMarkdown: string;
  jobDescription: string;
  userSubscriptionStatus: string; // 'active' o 'none'
  promptId?: string;
  candidateName?: string;
  careerProfileContext?: string;
}

export class AIService {
  private static extractCandidateName(markdown: string): string | null {
    if (!markdown) return null;
    const lines = markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        const name = trimmed.slice(2)
          .replace(/\*\*/g, '')
          .replace(/\*/g, '')
          .replace(/__/g, '')
          .replace(/_/g, '')
          .trim();
        if (name && !/^(curriculum\s*vitae|cv|resumen|resume|curriculum)$/i.test(name)) {
          return name;
        }
      }
    }
    return null;
  }

  private static async getSetting(key: string, defaultValue: string): Promise<string> {
    return getAiSetting(key, defaultValue);
  }

  private static templatePrompt(template: string, cv: string, job: string): string {
    return template
      .replace(/\{\{cv\}\}/g, cv)
      .replace(/\{\{job\}\}/g, job);
  }

  /**
   * Resuelve un prompt desde el código y permite una sobrescritura opcional
   * desde la tabla de administración. La fila de DB nunca es obligatoria:
   * una instalación nueva, una DB sin seed o una DB temporalmente caída
   * siguen usando el prompt versionado en la aplicación.
   */
  private static async resolvePrompt(key: BuiltInPromptKey, promptId?: string) {
    const builtInPrompt = getBuiltInPrompt(key);

    try {
      const [dbPrompt] = await db
        .select()
        .from(prompts)
        .where(
          promptId
            ? eq(prompts.id, promptId)
            : and(eq(prompts.key, key), eq(prompts.isActive, true))
        )
        .limit(1);

      // No aceptamos una fila incompleta como prompt operativo. Así, incluso
      // si existe un registro vacío o antiguo, el flujo conserva un fallback
      // válido y totalmente versionado en código.
      if (dbPrompt?.systemPrompt?.trim() && dbPrompt.userPrompt?.trim()) {
        return {
          ...builtInPrompt,
          systemPrompt: dbPrompt.systemPrompt,
          userPrompt: dbPrompt.userPrompt,
          isStrict: dbPrompt.isStrict,
        };
      }
    } catch (err) {
      console.error(`[AIService] Error al obtener prompt "${key}" de la DB. Usando prompt integrado:`, err);
    }

    return builtInPrompt;
  }

  static async optimizeCV({ baseCvMarkdown, jobDescription, userSubscriptionStatus, promptId }: OptimizeRequest): Promise<string> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');

    const resolvedPrompt = await this.resolvePrompt('optimize_cv', promptId);
    const systemPrompt = resolvedPrompt.systemPrompt;
    const userPromptTemplate = resolvedPrompt.userPrompt;

    if (!isPro) {
      // [FREE] Enrutamiento Plan FREE
      const provider = await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      const model = await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

      const defaultSystem = "Eres un asesor de empleo profesional. Optimiza el CV del usuario de acuerdo a la oferta. Devuelve SOLO el markdown resultante sin explicaciones y sin bloques de código.";
      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + "\n\n" + CV_HONESTY_INSTRUCTIONS;
      const finalUserPrompt = userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, baseCvMarkdown, jobDescription)
        : `CV Base:\n${baseCvMarkdown}\n\nOferta de Empleo:\n${jobDescription}`;

      if (provider === 'gemini') {
        return await this.callGeminiOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else if (provider === 'deepseek') {
        return await this.callDeepSeekOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else {
        return await this.callOpenRouter(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      }
    } else {
      // [PRO] Enrutamiento Plan PRO
      const provider = await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER);
      const model = await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider));

      const defaultSystem = provider === 'gemini'
        ? "Eres un redactor experto de CVs estilo Harvard. Toma el siguiente CV Base y optimízalo detalladamente para encajar con los requisitos de la Oferta de Trabajo. Incrementa el match semántico, prioriza secciones relevantes y utiliza la fórmula XYZ para describir logros. Devuelve la salida en Markdown limpio sin bloques de código tipo triple backtick."
        : "Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (fórmula XYZ) basados en la experiencia real provista en el CV Base. No inventes experiencias que no estén en el CV base, solo optimiza la redacción y priorización de las mismas. Devuelve el resultado exclusivamente en formato Markdown estructurado válido, sin bloques de código ni explicaciones.";

      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + "\n\n" + CV_HONESTY_INSTRUCTIONS;
      const finalUserPrompt = userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, baseCvMarkdown, jobDescription)
        : `CV Base:\n${baseCvMarkdown}\n\nOferta de Trabajo:\n${jobDescription}`;

      if (provider === 'gemini') {
        return await this.callGeminiOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else if (provider === 'openrouter') {
        return await this.callOpenRouter(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else {
        return await this.callDeepSeekOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      }
    }
  }

  static async importCV({ rawText, userSubscriptionStatus }: { rawText: string; userSubscriptionStatus: string }): Promise<string> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');

    const resolvedPrompt = await this.resolvePrompt('import_cv');
    const { systemPrompt, userPrompt: userPromptTemplate, isStrict } = resolvedPrompt;

    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER) 
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
    
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    const finalSystemPrompt = systemPrompt + (isStrict ? "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS : "");
    const finalUserPrompt = userPromptTemplate.replace(/\{\{cv\}\}/g, rawText);

    if (provider === 'gemini') {
      return await this.callGeminiOficial(rawText, '', model, finalSystemPrompt, finalUserPrompt);
    } else if (provider === 'deepseek') {
      return await this.callDeepSeekOficial(rawText, '', model, finalSystemPrompt, finalUserPrompt);
    } else {
      return await this.callOpenRouter(rawText, '', model, finalSystemPrompt, finalUserPrompt);
    }
  }

  static async optimizeCVStream({ baseCvMarkdown, jobDescription, userSubscriptionStatus, promptId, candidateName, careerProfileContext }: OptimizeRequest): Promise<ReadableStream<Uint8Array>> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');

    const resolvedPrompt = await this.resolvePrompt('optimize_cv', promptId);
    const systemPrompt = resolvedPrompt.systemPrompt;
    const userPromptTemplate = resolvedPrompt.userPrompt;

    const resolvedName = this.extractCandidateName(baseCvMarkdown) || candidateName || "Candidato";
    const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: El currículum DEBE comenzar obligatoriamente con el nombre del candidato en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;
    const profileDirective = careerProfileContext?.trim()
      ? `\n\nPERFIL MAESTRO DEL CANDIDATO (fuente de la verdad de trayectoria y objetivo; no inventes fuera de esto ni del CV):\n${careerProfileContext.trim().slice(0, 3200)}`
      : '';

    if (!isPro) {
      const provider = await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      const model = await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

      const defaultSystem = "Eres un asesor de empleo profesional. Optimiza el CV del usuario de acuerdo a la oferta. Devuelve SOLO el markdown resultante sin explicaciones y sin bloques de código.";
      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + "\n\n" + CV_HONESTY_INSTRUCTIONS + nameDirective + profileDirective;
      const finalUserPrompt = (userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, baseCvMarkdown, jobDescription)
        : `CV Base:\n${baseCvMarkdown}\n\nOferta de Empleo:\n${jobDescription}`) + profileDirective;

      if (provider === 'gemini') {
        return await this.streamGeminiOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else if (provider === 'deepseek') {
        return await this.streamDeepSeekOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else {
        return await this.streamOpenRouter(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      }
    } else {
      const provider = await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER);
      const model = await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider));

      const defaultSystem = provider === 'gemini'
        ? "Eres un redactor experto de CVs estilo Harvard. Toma el siguiente CV Base y optimízalo detalladamente para encajar con los requisitos de la Oferta de Trabajo. Incrementa el match semántico, prioriza secciones relevantes y utiliza la fórmula XYZ para describir logros. Devuelve la salida en Markdown limpio sin bloques de código tipo triple backtick."
        : "Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (fórmula XYZ) basados en la experiencia real provista en el CV Base. No inventes experiencias que no estén en el CV base, solo optimiza la redacción y priorización de las mismas. Devuelve el resultado exclusivamente en formato Markdown estructurado válido, sin bloques de código ni explicaciones.";

      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + "\n\n" + CV_HONESTY_INSTRUCTIONS + nameDirective + profileDirective;
      const finalUserPrompt = (userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, baseCvMarkdown, jobDescription)
        : `CV Base:\n${baseCvMarkdown}\n\nOferta de Trabajo:\n${jobDescription}`) + profileDirective;

      if (provider === 'gemini') {
        return await this.streamGeminiOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else if (provider === 'openrouter') {
        return await this.streamOpenRouter(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      } else {
        return await this.streamDeepSeekOficial(baseCvMarkdown, jobDescription, model, finalSystemPrompt, finalUserPrompt);
      }
    }
  }

  static async importCVStream({ rawText, userSubscriptionStatus, candidateName }: { rawText: string; userSubscriptionStatus: string; candidateName?: string }): Promise<ReadableStream<Uint8Array>> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');

    const resolvedPrompt = await this.resolvePrompt('import_cv');
    const { systemPrompt, userPrompt: userPromptTemplate, isStrict } = resolvedPrompt;

    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER) 
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
    
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    const resolvedName = this.extractCandidateName(rawText) || candidateName || "Candidato";
    const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: Identifica el nombre de la persona en el CV (usualmente al principio). El currículum resultante DEBE comenzar obligatoriamente con ese nombre propio en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;

    const finalSystemPrompt = systemPrompt + (isStrict ? "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS : "") + nameDirective;
    const finalUserPrompt = userPromptTemplate.replace(/\{\{cv\}\}/g, rawText);

    if (provider === 'gemini') {
      return await this.streamGeminiOficial(rawText, '', model, finalSystemPrompt, finalUserPrompt);
    } else if (provider === 'deepseek') {
      return await this.streamDeepSeekOficial(rawText, '', model, finalSystemPrompt, finalUserPrompt);
    } else {
      return await this.streamOpenRouter(rawText, '', model, finalSystemPrompt, finalUserPrompt);
    }
  }

  /**
   * Resuelve la API key de un proveedor.
   * - Si falta o es mock: solo permite fallback simulado con ALLOW_AI_MOCK=true.
   * - En cualquier otro caso lanza error claro (evita CVs inventados tipo "Matchply Corp").
   */
  private static resolveProviderApiKey(envVar: string, providerLabel: string): string | null {
    const key = (process.env[envVar] || '').trim();
    const isMissingOrMock = !key || /mock-?key/i.test(key);
    if (!isMissingOrMock) return key;

    const allowMock =
      process.env.ALLOW_AI_MOCK === 'true' ||
      process.env.ALLOW_AI_MOCK === '1';

    if (allowMock) return null;

    throw new Error(
      `${providerLabel}: no hay ${envVar} válida en el servidor. ` +
      `Añádela a .env (o al entorno Docker/VPS) y reinicia Next.js. ` +
      `Para usar respuestas simuladas en local, define ALLOW_AI_MOCK=true.`
    );
  }

  private static extractGeminiText(payload: any): string {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts
      .filter((part: any) => typeof part?.text === 'string' && part.thought !== true)
      .map((part: any) => part.text as string)
      .join('');
  }

  private static async callOpenRouter(
    cv: string, 
    job: string, 
    model: string, 
    systemPrompt: string, 
    userPrompt: string
  ): Promise<string> {
    const key = this.resolveProviderApiKey('OPENROUTER_API_KEY', 'OpenRouter');
    if (!key) {
      return this.getMockCvResponse(cv, job, `OpenRouter (Modelo: ${model})`);
    }

    // Sanitizar el identificador del modelo para OpenRouter
    let sanitizedModel = model;
    
    // Si empieza por 'openrouter/', analizamos si es un prefijo redundante
    if (sanitizedModel.startsWith('openrouter/')) {
      const rest = sanitizedModel.slice('openrouter/'.length);
      // Si el resto ya contiene una barra (ej. 'google/gemma-...') o empieza por 'gpt-'
      if (rest.includes('/') || rest.startsWith('gpt-')) {
        sanitizedModel = rest;
      }
    }
    
    // Si empieza por 'gpt-', nos aseguramos de que lleve el prefijo de OpenAI para OpenRouter
    if (sanitizedModel.startsWith('gpt-')) {
      sanitizedModel = 'openai/' + sanitizedModel;
    }

    try {
      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXTAUTH_URL || "https://matchply.com",
          "X-OpenRouter-Title": "Matchply",
        },
        body: JSON.stringify({
          model: sanitizedModel,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        })
      }, AI_FETCH_TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de OpenRouter (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error("La respuesta recibida de OpenRouter no tiene el formato esperado.");
      }
      log({ event: 'ai_usage', provider: 'openrouter', model, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens });
      return data.choices[0].message.content;
    } catch (e: any) {
      console.error("OpenRouter error:", e);
      throw new Error(`Ha ocurrido un error al optimizar el CV con OpenRouter: ${e.message}`);
    }
  }

  private static async callDeepSeekOficial(
    cv: string, 
    job: string, 
    model: string, 
    systemPrompt: string, 
    userPrompt: string
  ): Promise<string> {
    const key = this.resolveProviderApiKey('DEEPSEEK_API_KEY', 'DeepSeek');
    if (!key) {
      return this.getMockCvResponse(cv, job, `DeepSeek Oficial (Modelo: ${model})`);
    }

    try {
      const response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userPrompt
            }
          ]
        })
      }, AI_FETCH_TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de DeepSeek (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error("La respuesta recibida de DeepSeek no tiene el formato esperado.");
      }
      log({ event: 'ai_usage', provider: 'deepseek', model, inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens });
      return data.choices[0].message.content;
    } catch (e: any) {
      console.error("DeepSeek error:", e);
      throw new Error(`Ha ocurrido un error al optimizar el CV con DeepSeek: ${e.message}`);
    }
  }

  private static async callGeminiOficial(
    cv: string, 
    job: string, 
    model: string, 
    systemPrompt: string, 
    userPrompt: string
  ): Promise<string> {
    const key = this.resolveProviderApiKey('GEMINI_API_KEY', 'Gemini');
    if (!key) {
      return this.getMockCvResponse(cv, job, `Gemini Oficial (Modelo: ${model})`);
    }

    try {
      const response = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: userPrompt
              }]
            }],
            systemInstruction: {
              parts: [{
                text: systemPrompt
              }]
            },
            generationConfig: {
              temperature: 0.2,
            }
          })
        },
        AI_FETCH_TIMEOUT_MS,
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de Gemini (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
      log({ event: 'ai_usage', provider: 'gemini', model, inputTokens: data.usageMetadata?.promptTokenCount, outputTokens: data.usageMetadata?.candidatesTokenCount });
      const text = this.extractGeminiText(data);
      if (!text.trim()) {
        const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';
        const blockReason = data?.promptFeedback?.blockReason;
        throw new Error(
          `Gemini devolvió una respuesta vacía (finishReason=${finishReason}` +
          `${blockReason ? `, blockReason=${blockReason}` : ''}). Prueba otro modelo o revisa la cuota.`
        );
      }
      return text;
    } catch (e: any) {
      console.error("Gemini error:", e);
      throw new Error(`Ha ocurrido un error al optimizar el CV con Gemini: ${e.message}`);
    }
  }

  private static async streamOpenRouter(
    cv: string,
    job: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<ReadableStream<Uint8Array>> {
    const key = this.resolveProviderApiKey('OPENROUTER_API_KEY', 'OpenRouter');
    if (!key) {
      return this.streamMockResponse(cv, job, `OpenRouter (Modelo: ${model})`);
    }

    let sanitizedModel = model;
    if (sanitizedModel.startsWith('openrouter/')) {
      const rest = sanitizedModel.slice('openrouter/'.length);
      if (rest.includes('/') || rest.startsWith('gpt-')) {
        sanitizedModel = rest;
      }
    }
    if (sanitizedModel.startsWith('gpt-')) {
      sanitizedModel = 'openai/' + sanitizedModel;
    }

    const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXTAUTH_URL || "https://matchply.com",
        "X-OpenRouter-Title": "Matchply",
      },
      body: JSON.stringify({
        model: sanitizedModel,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    }, AI_STREAM_CONNECT_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de API de OpenRouter (${response.status}): ${response.statusText || errorText}`);
    }

    return this.createUnifiedSseStream(response.body!);
  }

  private static async streamDeepSeekOficial(
    cv: string,
    job: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<ReadableStream<Uint8Array>> {
    const key = this.resolveProviderApiKey('DEEPSEEK_API_KEY', 'DeepSeek');
    if (!key) {
      return this.streamMockResponse(cv, job, `DeepSeek Oficial (Modelo: ${model})`);
    }

    const response = await fetchWithTimeout("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.2,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    }, AI_STREAM_CONNECT_TIMEOUT_MS);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de API de DeepSeek (${response.status}): ${response.statusText || errorText}`);
    }

    return this.createUnifiedSseStream(response.body!);
  }

  private static async streamGeminiOficial(
    cv: string,
    job: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<ReadableStream<Uint8Array>> {
    const key = this.resolveProviderApiKey('GEMINI_API_KEY', 'Gemini');
    if (!key) {
      return this.streamMockResponse(cv, job, `Gemini Oficial (Modelo: ${model})`);
    }

    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: userPrompt
            }]
          }],
          systemInstruction: {
            parts: [{
              text: systemPrompt
            }]
          },
          generationConfig: {
            temperature: 0.2,
          }
        })
      },
      AI_STREAM_CONNECT_TIMEOUT_MS,
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de API de Gemini (${response.status}): ${response.statusText || errorText}`);
    }

    if (!response.body) {
      throw new Error('Gemini no devolvió un cuerpo de streaming.');
    }

    return this.createGeminiSseStream(response.body);
  }

  private static createGeminiSseStream(
    rawStream: ReadableStream<Uint8Array>
  ): ReadableStream<Uint8Array> {
    const reader = rawStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';
    let emittedAny = false;

    return new ReadableStream({
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                emittedAny = AIService.processGeminiSseLine(buffer, controller, encoder) || emittedAny;
              }
              if (!emittedAny) {
                controller.error(new Error(
                  'Gemini devolvió un stream vacío. Revisa el modelo configurado y la cuota de GEMINI_API_KEY.'
                ));
                return;
              }
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let enqueuedAny = false;
            for (const line of lines) {
              if (AIService.processGeminiSseLine(line, controller, encoder)) {
                emittedAny = true;
                enqueuedAny = true;
              }
            }

            if (enqueuedAny) break;
          }
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel();
      }
    });
  }

  private static processGeminiSseLine(
    line: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder,
  ): boolean {
    const cleanLine = line.trim();
    if (!cleanLine.startsWith('data:')) return false;
    const data = cleanLine.slice(5).trim();
    if (!data || data === '[DONE]') return false;
    try {
      const json = JSON.parse(data);
      const text = AIService.extractGeminiText(json);
      if (text) {
        controller.enqueue(encoder.encode(text));
        return true;
      }
    } catch {
      // Chunk incompleto o no JSON
    }
    return false;
  }

  private static streamMockResponse(
    cv: string,
    job: string,
    providerName: string
  ): ReadableStream<Uint8Array> {
    const mockContent = this.getMockCvResponse(cv, job, providerName);
    const encoder = new TextEncoder();
    
    let index = 0;
    const chunkSize = 15;
    
    return new ReadableStream({
      async pull(controller) {
        if (index >= mockContent.length) {
          controller.close();
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 30));
        
        const chunk = mockContent.slice(index, index + chunkSize);
        index += chunkSize;
        controller.enqueue(encoder.encode(chunk));
      }
    });
  }

  private static createUnifiedSseStream(
    rawStream: ReadableStream<Uint8Array>
  ): ReadableStream<Uint8Array> {
    const reader = rawStream.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    return new ReadableStream({
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (buffer.trim()) {
                AIService.processSseLine(buffer, controller, encoder);
              }
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            let enqueuedAny = false;
            for (const line of lines) {
              const processed = AIService.processSseLine(line, controller, encoder);
              if (processed) {
                enqueuedAny = true;
              }
            }
            
            if (enqueuedAny) {
              break;
            }
          }
        } catch (err) {
          controller.error(err);
        }
      },
      cancel() {
        reader.cancel();
      }
    });
  }

  private static processSseLine(
    line: string,
    controller: ReadableStreamDefaultController<Uint8Array>,
    encoder: TextEncoder
  ): boolean {
    const cleanLine = line.trim();
    if (!cleanLine.startsWith('data:')) return false;
    const data = cleanLine.slice(5).trim();
    if (data === '[DONE]') return false;
    try {
      const json = JSON.parse(data);
      const text = json.choices?.[0]?.delta?.content || '';
      if (text) {
        controller.enqueue(encoder.encode(text));
        return true;
      }
    } catch (e) {
      // Ignore parse errors for incomplete JSON lines
    }
    return false;
  }

  /** Compatibility adapter for previously queued evaluations; uses the same scorer. */
  static async analyzeSTARStream({ cvMarkdown, jobDescription, company, jobTitle = '', userSubscriptionStatus, careerProfile }: {
    cvMarkdown: string; jobDescription: string; company: string; jobTitle?: string;
    userSubscriptionStatus: string; careerProfile?: any;
  }): Promise<ReadableStream<Uint8Array>> {
    const result = await this.curateOffersBatch({
      baseCvMarkdown: cvMarkdown, userCareerProfile: careerProfile, userSubscriptionStatus,
      offers: [{ id: 'offer', title: jobTitle, company, description: jobDescription, platform: 'other' }], kind: 'deep',
    });
    if (!result.curated[0]) throw new Error(result.errors[0]?.message || 'No se pudo calcular el match');
    const encoder = new TextEncoder();
    return new ReadableStream({ start(controller) {
      controller.enqueue(encoder.encode(JSON.stringify({ curated: result.curated })));
      controller.close();
    } });
  }

  private static getMockCvResponse(cv: string, job: string, providerName: string): string {
    // Generador de CV optimizado simulado de alta calidad
    const lines = cv.split('\n');
    let name = "Tu Nombre";
    const contactLines: string[] = [];
    const experienceLines: string[] = [];
    const skillLines: string[] = [];
    
    let currentSec = "";
    
    for (const line of lines) {
      if (line.startsWith('# ')) {
        name = line.slice(2).trim();
      } else if (line.startsWith('**') && !currentSec) {
        contactLines.push(line);
      } else if (line.startsWith('## ')) {
        currentSec = line.slice(3).toLowerCase();
      } else if (currentSec.includes('experienc') || currentSec.includes('trayect') || currentSec.includes('historial')) {
        experienceLines.push(line);
      } else if (currentSec.includes('habilid') || currentSec.includes('skills') || currentSec.includes('conocim')) {
        skillLines.push(line);
      }
    }
    
    const jobKeywords = job.toLowerCase().match(/\b(react|typescript|node|next\.js|tailwindcss|drizzle|docker|postgresql|stripe|api|cloud|gestion|liderazgo)\b/g) || [];
    const uniqueKeywords = Array.from(new Set(jobKeywords)).map(k => k.charAt(0).toUpperCase() + k.slice(1));
    
    const addedSkills = uniqueKeywords.length > 0 
      ? `\n- **Alineación Técnica Especial:** ${uniqueKeywords.join(', ')} (Optimizada para esta oferta)`
      : "";

    return `# ${name}
 
${contactLines.join('\n')}

## Perfil Profesional
Asesor de empleo IA optimizado mediante **${providerName}** para encajar con el puesto requerido. Match semántico incrementado, enfoque basado en logros cuantificables y fórmula XYZ para resaltar impacto empresarial.

## Experiencia Profesional
### Desarrollador de Software Senior (Optimizado para Oferta)
**Matchply Corp** | *2024 - Presente*
- Lideré el desarrollo e integración de soluciones SaaS optimizadas mediante la integración de APIs avanzadas de IA.
- Diseñé esquemas relacionales ágiles que aceleraron el tiempo de carga del motor de rendering un **35%**.
- Redacté código limpio, robusto y escalable aplicando principios SOLID y optimizando pipelines de integración de datos.

### Ingeniero de Software Full Stack
**Tech Innovators S.L.** | *2021 - 2024*
- Colaboré en la modernización de la plataforma core del cliente, lo que aumentó la tasa de retención de usuarios en un **12%**.
- Optimicé procesos críticos de facturación digital e integré pasarelas de pago Stripe con arquitecturas asíncronas de webhooks.

## Habilidades
- **Frontend Avanzado:** Next.js (App Router), React, Tailwind CSS, TypeScript
- **Backend & Bases de Datos:** Node.js, Drizzle ORM, PostgreSQL, REST APIs${addedSkills}
- **Metodologías & DevOps:** Docker, CI/CD, Git, Arquitectura de Microservicios
`;
  }

  static async generateOutreachAndPrep({
    cvContent,
    jobDescription,
    company,
    jobTitle,
    userSubscriptionStatus
  }: {
    cvContent: string;
    jobDescription: string;
    company: string;
    jobTitle: string;
    userSubscriptionStatus: string;
  }): Promise<{ outreachMessage: string; coverLetter: string; interviewQuestions: any[] }> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    
    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER)
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    const systemPrompt = `Eres un experto en selección de personal y marca profesional. Tu tarea es generar:
1. Un email o mensaje de contacto corto (outreach) para enviar al reclutador por LinkedIn o email (máximo 150 palabras, tono profesional y persuasivo, adaptado a la vacante y la experiencia del candidato).
2. Una carta de presentación (cover letter) profesional y adaptada estilo Harvard (máximo 300 palabras).
3. Una lista de las 3-5 preguntas técnicas y de comportamiento más probables en una entrevista para esta vacante, junto con consejos clave para responder cada una usando la experiencia del candidato.

Debes responder ÚNICA y EXCLUSIVAMENTE con un objeto JSON válido que contenga las siguientes claves:
{
  "outreachMessage": "...",
  "coverLetter": "...",
  "interviewQuestions": [
    {
      "question": "...",
      "tip": "..."
    }
  ]
}
No uses bloques de código Markdown (sin triple backticks). Responde directamente con el JSON parseable.`;

    const userPrompt = `CV del candidato:
${cvContent}

Oferta de empleo:
Puesto: ${jobTitle}
Empresa: ${company}
Descripción: ${jobDescription}`;

    let rawResponse = "";
    if (provider === 'gemini') {
      rawResponse = await this.callGeminiOficial(cvContent, jobDescription, model, systemPrompt, userPrompt);
    } else if (provider === 'deepseek') {
      rawResponse = await this.callDeepSeekOficial(cvContent, jobDescription, model, systemPrompt, userPrompt);
    } else {
      rawResponse = await this.callOpenRouter(cvContent, jobDescription, model, systemPrompt, userPrompt);
    }

    try {
      let cleanJson = rawResponse.trim();
      if (cleanJson.includes('```')) {
        const start = cleanJson.indexOf('{');
        const end = cleanJson.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          cleanJson = cleanJson.slice(start, end + 1);
        }
      }
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("[AIService.generateOutreachAndPrep] Error parsing JSON:", e, "Raw response:", rawResponse);
      return {
        outreachMessage: `Hola, me pongo en contacto en relación con la oferta de ${jobTitle} en ${company}...`,
        coverLetter: `Estimado equipo de ${company}, les escribo en relación con...`,
        interviewQuestions: [
          {
            question: "¿Por qué te interesa este puesto en nuestra empresa?",
            tip: "Enfócate en la cultura de la empresa y cómo tu perfil aporta valor."
          }
        ]
      };
    }
  }

  /**
   * Matching de ofertas:
   * - Candidate card una vez por lote
   * - Micro-lotes de 2
   * - Overall y gates en código
   * - Cache por hash en la fila
   */
  static async curateOffersBatch({
    baseCvMarkdown, userCareerProfile, offers, userSubscriptionStatus,
    targetThreshold = 65, kind = 'triage', onBatchComplete, onItemError,
    evaluationStartedAt = new Date().toISOString(),
  }: {
    baseCvMarkdown: string; userCareerProfile?: any; offers: CurationOfferInput[];
    userSubscriptionStatus: string; targetThreshold?: number; kind?: MatchKind;
    evaluationStartedAt?: string;
    onBatchComplete?: (items: CuratedMatchItem[]) => void | Promise<void>;
    onItemError?: (error: { id: string; message: string }) => void | Promise<void>;
  }): Promise<{ curated: CuratedMatchItem[]; errors: Array<{ id: string; message: string }> }> {
    const started = Date.now();
    if (!offers.length) return { curated: [], errors: [] };
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    const provider = await this.getSetting(isPro ? 'pro_provider' : 'free_provider', isPro ? DEFAULT_PRO_PROVIDER : DEFAULT_FREE_PROVIDER);
    const model = await this.getSetting(isPro ? 'pro_model' : 'free_model', getDefaultModelForProvider(isPro ? 'pro' : 'free', provider));
    const constraints = parseMatchConstraints(userCareerProfile || {});
    const candidateEvidence = buildCandidateEvidence(userCareerProfile, baseCvMarkdown, constraints);
    const systemPrompt = buildMatchSystemPrompt({ kind: 'triage', targetThreshold });
    const errors: Array<{ id: string; message: string }> = [];
    const results = new Map<string, CuratedMatchItem>();
    const reportError = async (id: string, error: unknown) => {
      const message = error instanceof MatchValidationError ? error.message : 'No se pudo actualizar el match. Vuelve a intentarlo.';
      const item = { id, message };
      errors.push(item);
      log({ event: 'match_item_failed', offerId: id, version: MATCH_PROMPT_VERSION,
        reason: error instanceof MatchValidationError ? error.code : 'evaluation_failed' });
      await onItemError?.(item);
    };
    const prepared = offers.map(offer => {
      const offerCard = buildOfferCard(offer, 'triage');
      const sourceHash = matchSourceHash({ candidateEvidence, offerCard, constraints });
      return { offer, offerCard, sourceHash, hash: matchInputHash({ candidateEvidence, offerCard, constraints, provider, model }) };
    });
    type Prepared = (typeof prepared)[number];
    const pending: Prepared[] = [];
    const finish = async (row: Prepared, item: CuratedMatchItem) => {
      item.evaluationStartedAt = evaluationStartedAt;
      if (kind === 'deep') {
        if (isMatchDetails(row.offer.matchDetails, item.evidence)) {
          item.details = row.offer.matchDetails;
        } else {
          const prompts = buildMatchExplanationPrompt(item.evidence);
          const raw = await this.callMatchText(provider, model, prompts.systemPrompt, prompts.userPrompt);
          const parsed = this.parseMatchJson(raw);
          item.details = normalizeMatchDetails(parsed, item.evidence);
        }
        item.kind = 'deep';
        item.fitReason = item.details.summary;
      }
      return item;
    };
    for (const row of prepared) {
      if (!candidateEvidence.sufficient || !row.offerCard.sufficient || !row.offerCard.complete) {
        await reportError(row.offer.id, new MatchValidationError('Faltan datos suficientes del perfil o de la oferta para calcular el match.', 'insufficient_input'));
        continue;
      }
      if (canReuseCachedMatch({ hash: row.hash, cachedHash: row.offer.matchInputHash,
        scoreOverall: row.offer.scoreOverall, scoreBreakdown: row.offer.scoreBreakdown,
        hasDescription: !!row.offer.description?.trim(), canonicalBreakdown: isCanonicalMatchBreakdown(row.offer.scoreBreakdown),
        evidence: row.offer.matchEvidence }) && isMatchEvidenceSnapshot(row.offer.matchEvidence)) {
        let cached: CuratedMatchItem;
        try {
          cached = await finish(row, cachedMatchItem({ offer: row.offer, score: row.offer.scoreOverall!,
            scoreBreakdown: row.offer.matchEvidence.scoreBreakdown, hash: row.hash, kind: 'triage', targetThreshold,
            evidence: row.offer.matchEvidence }));
        } catch (error) { await reportError(row.offer.id, error); continue; }
        // Persistence failures must propagate, never be converted to successful AI results.
        await onBatchComplete?.([cached]);
        results.set(cached.id, cached);
        log({ event: 'match_cache_hit', offerId: cached.id, kind, version: MATCH_PROMPT_VERSION });
      } else pending.push(row);
    }
    const batches: Prepared[][] = [];
    for (let i = 0; i < pending.length; i += 2) batches.push(pending.slice(i, i + 2));
    await this.mapWithConcurrency(batches, 4, async batch => {
      let parsed: any;
      try {
        const userPrompt = buildMatchUserPrompt({ candidateCard: candidateEvidence.card, offers: batch.map(row => row.offerCard) });
        parsed = this.parseMatchJson(await this.callMatchText(provider, model, systemPrompt, userPrompt));
        if (!parsed || !Array.isArray(parsed.curated)) throw new MatchValidationError('La IA no devolvió un cálculo válido.');
      } catch (error) {
        for (const row of batch) await reportError(row.offer.id, error);
        return;
      }
      for (const row of batch) {
        let item: CuratedMatchItem;
        try {
          const matches = parsed.curated.filter((value: any) => value && value.id === row.offer.id);
          if (matches.length !== 1) throw new MatchValidationError('La respuesta no contiene un único resultado para esta oferta.');
          item = normalizeMatchItem({ offer: row.offer, offerCard: row.offerCard, candidateCard: candidateEvidence.card,
            candidateEvidence, llm: matches[0], constraints, targetThreshold, kind: 'triage', model, provider });
          item = await finish(row, item);
        } catch (error) { await reportError(row.offer.id, error); continue; }
        await onBatchComplete?.([item]);
        results.set(item.id, item);
        log({ event: 'match_calculated', offerId: item.id, kind, version: MATCH_PROMPT_VERSION,
          adjustmentCodes: item.evidence.adjustments.map(adjustment => adjustment.code) });
      }
    });
    log({ event: 'match_batch_finished', version: MATCH_PROMPT_VERSION, provider, model,
      durationMs: Date.now() - started, succeeded: results.size, failed: errors.length });
    return { curated: offers.flatMap(offer => results.has(offer.id) ? [results.get(offer.id)!] : []), errors };
  }

  private static parseMatchJson(raw: string): any {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(text); } catch { throw new MatchValidationError('La IA devolvió JSON incompleto o inválido.'); }
  }

  private static async callMatchText(provider: string, model: string, systemPrompt: string, userPrompt: string): Promise<string> {
    const envName = provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENROUTER_API_KEY';
    if (!this.resolveProviderApiKey(envName, provider)) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
    const started = Date.now();
    const result = provider === 'gemini'
      ? await this.callGeminiOficial('', '', model, systemPrompt, userPrompt)
      : provider === 'deepseek'
        ? await this.callDeepSeekOficial('', '', model, systemPrompt, userPrompt)
        : await this.callOpenRouter('', '', model, systemPrompt, userPrompt);
    log({ event: 'match_llm_finished', provider, model, durationMs: Date.now() - started,
      inputCharacters: systemPrompt.length + userPrompt.length, outputCharacters: result.length });
    return result;
  }

  public static async callGenericText({
    systemPrompt,
    userPrompt,
    userSubscriptionStatus = 'none',
  }: {
    systemPrompt: string;
    userPrompt: string;
    userSubscriptionStatus?: string;
  }): Promise<string> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    
    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER)
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    if (provider === 'gemini') {
      return await this.callGeminiOficial("", "", model, systemPrompt, userPrompt);
    } else if (provider === 'deepseek') {
      return await this.callDeepSeekOficial("", "", model, systemPrompt, userPrompt);
    } else {
      return await this.callOpenRouter("", "", model, systemPrompt, userPrompt);
    }
  }

  static async classifyCareerProfile({
    dumpText,
    optionalTarget,
    userSubscriptionStatus,
  }: {
    dumpText: string;
    optionalTarget?: string;
    userSubscriptionStatus?: string;
  }): Promise<ProfileClassification> {
    const combined = [dumpText, optionalTarget].filter((part) => (part || '').trim()).join('\n');
    const heuristic = heuristicClassifyCareerProfile(combined);

    if (!dumpText.trim()) return heuristic;

    const systemPrompt = `Eres un clasificador de perfiles profesionales para una plataforma de empleo tech.
Nicho principal: desarrollo de software (frontend, backend, fullstack, mobile, datos, IA). Otros oficios se marcan non_software.

REGLAS:
- Infieré SOLO de lo escrito. No asumas stacks (ni React, ni Gemini, ni OpenRouter) si no aparecen.
- El objetivo profesional es OPCIONAL: inferredTargetRole solo si el texto lo dice o si te pasan un objetivo explícito. Si no, null.
- No conviertas a todo el mundo en AI Engineer.
- Devuelve ÚNICAMENTE JSON:
{"family":"frontend|backend|fullstack|mobile|data|ai|software_other|non_software","seniority":"junior|mid|senior|unknown","inferredTargetRole":null,"stackHints":["..."],"summary":"etiqueta corta en español"}`;

    const userPrompt = `Texto del candidato (CV, LinkedIn o notas):
---
${dumpText.slice(0, 12000)}
---
${optionalTarget?.trim() ? `Objetivo explícito opcional: ${optionalTarget.trim()}` : 'Sin objetivo explícito.'}`;

    try {
      const rawResponse = await this.callGenericText({
        systemPrompt,
        userPrompt,
        userSubscriptionStatus,
      });
      let clean = rawResponse.trim();
      if (clean.includes('```')) {
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);
      }
      return normalizeClassification(JSON.parse(clean), combined);
    } catch (error) {
      console.error('[AIService.classifyCareerProfile] fallback heurístico:', error);
      return heuristic;
    }
  }

  static async extractProfileFromRawText({
    rawText,
    userSubscriptionStatus,
  }: {
    rawText: string;
    userSubscriptionStatus?: string;
  }): Promise<{
    bio: string;
    experienceYears?: number | null;
    targetRoles?: string[];
    techStack?: {
      frontend?: string[];
      backend?: string[];
      ai_ml?: string[];
      cloud_devops?: string[];
      database?: string[];
    };
    skills?: Array<{
      name: string;
      category?: string;
      proficiency?: string;
      evidence?: string;
    }>;
    keyProjects?: Array<{
      title: string;
      role?: string;
      techStack?: string;
      description: string;
      impact?: string;
    }>;
    targetTransition?: {
      targetRole?: string;
      targetIndustries?: string;
      targetGeography?: string;
    };
    preferredWorkplaces?: string[];
    preferredLocations?: string;
    companyPreferences?: string;
    salaryMin?: number | null;
    salaryTarget?: number | null;
    curationCriteria?: string;
    masterDocument?: string;
  }> {
    const systemPrompt = `Eres un Chief Technology Officer (CTO) y Lead AI Recruiter de élite. Tu objetivo es analizar la información, CV o notas de un candidato y estructurar su "Perfil Profesional Maestro & Criterios".
Debes extraer solo lo que el texto demuestra: logros, tecnologías exactas y preferencias. No inventes stacks ni un rol objetivo. El objetivo profesional es opcional.

REGLAS DE SALIDA:
- Devuelve ÚNICA y EXCLUSIVAMENTE un JSON válido (sin triple backticks ni texto antes/después) con la siguiente estructura exacta:
{
  "bio": "Resumen de quién es según el texto...",
  "experienceYears": null,
  "targetRoles": [],
  "techStack": {
    "frontend": [],
    "backend": [],
    "ai_ml": [],
    "cloud_devops": [],
    "database": []
  },
  "keyProjects": [
    {
      "title": "Nombre del proyecto o empresa",
      "role": "Puesto / Rol desempeñado",
      "techStack": "Tecnologías clave empleadas",
      "description": "Qué construyó, reto técnico resuelto y arquitectura",
      "impact": "Métricas de impacto, automatizaciones o resultados conseguidos"
    }
  ],
  "targetTransition": {
    "targetRole": "",
    "targetIndustries": "",
    "targetGeography": ""
  },
  "preferredWorkplaces": [],
  "preferredLocations": "",
  "companyPreferences": "",
  "salaryMin": null,
  "salaryTarget": null,
  "curationCriteria": "",
  "masterDocument": "...",
  "skills": [
    { "name": "TypeScript", "category": "frontend", "proficiency": "core", "evidence": "Proyecto o logro real" }
  ]
}`;

    const userPrompt = `A continuación tienes la información bruta / CV / notas del candidato:
---
${rawText.slice(0, 15000)}
---

Por favor, estructura el Perfil Maestro completo en JSON según las instrucciones.`;

    const rawResponse = await this.callGenericText({
      systemPrompt,
      userPrompt,
      userSubscriptionStatus,
    });

    try {
      let clean = rawResponse.trim();
      if (clean.includes('```')) {
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          clean = clean.slice(start, end + 1);
        }
      }
      const parsed = JSON.parse(clean);
      return {
        ...parsed,
        ...hydrateStructuredProfile(parsed, { bio: parsed.bio, masterDocument: parsed.masterDocument, cvMarkdown: rawText }),
      };
    } catch (e) {
      console.error('[AIService.extractProfileFromRawText] Error parsing JSON:', e, 'Raw:', rawResponse);
      const fallback = {
        bio: rawText.slice(0, 800),
        experienceYears: null,
        targetRoles: [],
        techStack: { frontend: [], backend: [], ai_ml: [], cloud_devops: [], database: [] },
        keyProjects: [],
        targetTransition: { targetRole: '', targetIndustries: '', targetGeography: '' },
        preferredWorkplaces: [],
        preferredLocations: '',
        companyPreferences: '',
        salaryMin: null,
        salaryTarget: null,
        curationCriteria: '',
        masterDocument: rawText.slice(0, 2000),
      };
      return {
        ...fallback,
        ...hydrateStructuredProfile(fallback, { bio: fallback.bio, masterDocument: fallback.masterDocument, cvMarkdown: rawText }),
      };
    }
  }

  static async generateProfileInterviewQuestions({
    currentProfile,
    classification,
    dumpText,
    optionalTarget,
    userSubscriptionStatus,
  }: {
    currentProfile?: any;
    classification?: ProfileClassification;
    dumpText?: string;
    optionalTarget?: string;
    userSubscriptionStatus?: string;
  }): Promise<InterviewQuestion[]> {
    const dump = (dumpText || currentProfile?.bio || currentProfile?.masterDocument || '').trim();
    const resolvedClassification = classification || heuristicClassifyCareerProfile(
      [dump, optionalTarget].filter(Boolean).join('\n'),
    );

    const systemPrompt = `Eres un career coach para profesionales de software (y perfiles afines).
Formula 3 preguntas cortas para rellenar HUECOS del texto del candidato.

REGLAS:
- Nicho: desarrollo de software. Adapta frontend/backend/fullstack/mobile/datos/IA/junior/senior según la clasificación.
- Pregunta solo sobre lo que NO está claro en el texto. No preguntes Pinecone, RAG o Gemini si no aparecen.
- No asumas que quieren ser AI Engineer ni que usan un stack concreto.
- El objetivo profesional es OPCIONAL: una pregunta puede invitarlo, dejando claro que puede dejarla en blanco.
- suggestedAnswers vacío [] salvo que sea una paráfrasis de algo que YA dijo el candidato.
- No uses ejemplos de productos inventados ni de un usuario concreto.
- Devuelve ÚNICAMENTE un JSON array:
[{"id":"q1","category":"stack|projects|target","question":"...","hint":"...","suggestedAnswers":[]}]`;

    const userPrompt = `Clasificación: ${JSON.stringify(resolvedClassification)}
Objetivo explícito (opcional): ${optionalTarget?.trim() || 'ninguno'}
Texto / CV / notas:
---
${dump.slice(0, 10000) || 'Vacío'}
---`;

    try {
      const rawResponse = await this.callGenericText({
        systemPrompt,
        userPrompt,
        userSubscriptionStatus,
      });
      let clean = rawResponse.trim();
      if (clean.includes('```')) {
        const start = clean.indexOf('[');
        const end = clean.lastIndexOf(']');
        if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);
      }
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 4).map((item: any, index: number) => ({
          id: String(item.id || `q${index + 1}`),
          category: String(item.category || 'projects'),
          question: String(item.question || '').trim(),
          hint: String(item.hint || '').trim(),
          suggestedAnswers: Array.isArray(item.suggestedAnswers)
            ? item.suggestedAnswers.map(String).filter(Boolean).slice(0, 3)
            : [],
        })).filter((item: InterviewQuestion) => item.question.length > 10);
      }
    } catch (e) {
      console.error('[AIService.generateProfileInterviewQuestions] fallback genérico:', e);
    }

    return genericSoftwareInterviewQuestions(resolvedClassification);
  }

  static async synthesizeProfileFromInterview({
    currentProfile,
    qaList,
    dumpText,
    optionalTarget,
    classification,
    userSubscriptionStatus,
  }: {
    currentProfile: any;
    qaList: Array<{ question: string; answer: string }>;
    dumpText?: string;
    optionalTarget?: string;
    classification?: ProfileClassification;
    userSubscriptionStatus?: string;
  }): Promise<any> {
    const systemPrompt = `Redactas el perfil maestro de un candidato para matching de ofertas y adaptación de CVs.
Público principal: desarrolladores de software de cualquier seniority. Si el perfil no es software, redacta con honestidad lo que hay.

REGLAS:
- Documento maestro: 250-400 palabras. Quién es, qué ha hecho, con qué tecnología, y el norte SOLO si lo ha dicho.
- NO inventes herramientas, empresas, métricas ni un rol objetivo. Si no dijo "quiero ser X", no lo inventes.
- Si pidió no enfatizar algo (p. ej. Dynamics/Microsoft), menciónalo de paso o omítelo.
- Extrae campos estructurados solo de evidencias del texto. Arrays vacíos si no hay datos. Salario null si no lo dijo.
- preferredWorkplaces vacío si no lo dijo.
- Devuelve ÚNICAMENTE JSON:
{"bio":"...","experienceYears":null,"targetRoles":[],"techStack":{"frontend":[],"backend":[],"ai_ml":[],"cloud_devops":[],"database":[]},"keyProjects":[],"skills":[{"name":"...","category":"backend","proficiency":"solid","evidence":"..."}],"targetTransition":{"targetRole":"","targetIndustries":"","targetGeography":""},"preferredWorkplaces":[],"preferredLocations":"","companyPreferences":"","salaryMin":null,"salaryTarget":null,"curationCriteria":"","masterDocument":"..."}`;

    const userPrompt = `Clasificación: ${JSON.stringify(classification || {})}
Objetivo explícito opcional: ${optionalTarget?.trim() || 'ninguno'}
Borrador / CV:
---
${(dumpText || currentProfile?.bio || '').slice(0, 12000)}
---
Perfil previo (JSON):
${JSON.stringify(currentProfile || {}, null, 2).slice(0, 4000)}

Respuestas de la entrevista:
${qaList.map((qa, i) => `P${i + 1}: ${qa.question}\nR: ${qa.answer}`).join('\n\n')}`;

    const rawResponse = await this.callGenericText({
      systemPrompt,
      userPrompt,
      userSubscriptionStatus,
    });

    try {
      let clean = rawResponse.trim();
      if (clean.includes('```')) {
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
          clean = clean.slice(start, end + 1);
        }
      }
      const parsed = JSON.parse(clean);
      return {
        ...currentProfile,
        ...parsed,
        ...hydrateStructuredProfile({ ...currentProfile, ...parsed }, {
          bio: parsed.bio || dumpText,
          masterDocument: parsed.masterDocument,
          cvMarkdown: dumpText,
        }),
      };
    } catch (e) {
      console.error('[AIService.synthesizeProfileFromInterview] Error parsing JSON:', e, 'Raw:', rawResponse);
      const combined = [
        dumpText || currentProfile?.bio || '',
        ...qaList.map((qa) => qa.answer),
      ].filter(Boolean).join('\n\n');
      const fallback = {
        ...currentProfile,
        bio: (dumpText || currentProfile?.bio || combined).trim(),
        masterDocument: combined.trim().slice(0, 2500),
      };
      return {
        ...fallback,
        ...hydrateStructuredProfile(fallback, { bio: fallback.bio, masterDocument: fallback.masterDocument, cvMarkdown: dumpText }),
      };
    }
  }

  static async polishProfileSection({
    sectionType,
    currentContent,
    userSubscriptionStatus,
  }: {
    sectionType: 'bio' | 'curationCriteria' | 'project' | 'target';
    currentContent: string;
    userSubscriptionStatus?: string;
  }): Promise<string> {
    const systemPrompt = `Eres un experto redactor de perfiles técnicos y headhunter internacional.
Tu tarea es reescribir y pulir el texto de la sección "${sectionType}" proporcionada por un profesional tech.

DIRECTRICES:
- Si es "bio": Hazla concisa, orientada a impacto y resultados, destacando stack y valor técnico sin caer en clichés corporativos vacíos.
- Si es "curationCriteria": Conviértelo en reglas claras e inequívocas para que un sistema de scoring de ofertas sepa exactamente qué priorizar, qué penalizar y qué descartar.
- Si es "project": Enfatiza arquitectura técnica, problemas resueltos y métricas de impacto (fórmula XYZ).
- Conserva al 100% la verdad de los datos; NO inventes tecnologías que no aparezcan en el texto original.
- Devuelve DIRECTAMENTE el texto pulido en Markdown simple (sin preámbulos ni bloques envolventes de código).`;

    const userPrompt = `Texto actual a pulir:\n${currentContent}`;

    const rawResponse = await this.callGenericText({
      systemPrompt,
      userPrompt,
      userSubscriptionStatus,
    });

    return rawResponse.trim();
  }

  private static async mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);

    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= items.length) return;
        results[current] = await fn(items[current], current);
      }
    });

    await Promise.all(workers);
    return results;
  }

  static async buildDebugPrompt(
    action: AiPromptDebugAction,
    payload: any,
    userContext: {
      userId?: string;
      subscriptionStatus?: string;
      careerProfile?: any;
    } = {}
  ): Promise<{
    actionTitle: string;
    provider: string;
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }> {
    const isPro = canAccessFeature(userContext.subscriptionStatus || 'none', 'advancedAi');
    const provider = await this.getSetting(
      isPro ? 'pro_provider' : 'free_provider',
      isPro ? DEFAULT_PRO_PROVIDER : DEFAULT_FREE_PROVIDER,
    );
    const model = await this.getSetting(
      isPro ? 'pro_model' : 'free_model',
      getDefaultModelForProvider(isPro ? 'pro' : 'free', provider),
    );

    if (action === 'optimize_cv') {
      const resolvedPrompt = await this.resolvePrompt('optimize_cv', payload.promptId);
      const systemPrompt = resolvedPrompt.systemPrompt;
      const userPromptTemplate = resolvedPrompt.userPrompt;
      const resolvedName = this.extractCandidateName(payload.baseCvMarkdown || '') || payload.candidateName || 'Candidato';
      const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: El currículum DEBE comenzar obligatoriamente con el nombre del candidato en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;
      const profileDirective = payload.careerProfileContext?.trim()
        ? `\n\nPERFIL MAESTRO DEL CANDIDATO (fuente de la verdad de trayectoria y objetivo; no inventes fuera de esto ni del CV):\n${payload.careerProfileContext.trim().slice(0, 3200)}`
        : '';
      const defaultSystem = isPro
        ? (provider === 'gemini'
            ? 'Eres un redactor experto de CVs estilo Harvard. Toma el siguiente CV Base y optimízalo detalladamente para encajar con los requisitos de la Oferta de Trabajo. Incrementa el match semántico, prioriza secciones relevantes y utiliza la fórmula XYZ para describir logros. Devuelve la salida en Markdown limpio sin bloques de código tipo triple backtick.'
            : 'Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (fórmula XYZ) basados en la experiencia real provista en el CV Base. No inventes experiencias que no estén en el CV base, solo optimiza la redacción y priorización de las mismas. Devuelve el resultado exclusivamente en formato Markdown estructurado válido, sin bloques de código ni explicaciones.')
        : 'Eres un asesor de empleo profesional. Optimiza el CV del usuario de acuerdo a la oferta. Devuelve SOLO el markdown resultante sin explicaciones y sin bloques de código.';

      const finalSystem = (systemPrompt || defaultSystem) + '\n\n' + MARKDOWN_STRUCTURE_INSTRUCTIONS + '\n\n' + CV_HONESTY_INSTRUCTIONS + nameDirective + profileDirective;
      const finalUser = (userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, payload.baseCvMarkdown || '', payload.jobDescription || '')
        : `CV Base:\n${payload.baseCvMarkdown || ''}\n\nOferta de Empleo:\n${payload.jobDescription || ''}`) + profileDirective;

      return {
        actionTitle: 'Optimización de CV con IA',
        provider,
        model,
        systemPrompt: finalSystem,
        userPrompt: finalUser,
      };
    }

    if (action === 'curate_offers') {
      const userProfile = userContext.careerProfile || {};
      const kind: MatchKind = payload.kind === 'deep' ? 'deep' : 'triage';
      const targetThreshold = payload.targetThreshold || 65;
      const constraints = parseMatchConstraints(userProfile);
      const candidateCard = buildCandidateCard(userProfile, payload.baseCvMarkdown || '', constraints);
      const rawOffers = Array.isArray(payload.offers) ? payload.offers : [];
      const offerCards = rawOffers.map((offer: any) => buildOfferCard({
        id: offer.id,
        title: offer.title,
        company: offer.company,
        description: offer.description,
        platform: offer.platform,
        tldr: offer.tldr,
        sourceMetadata: offer.sourceMetadata,
      }, kind));

      return {
        actionTitle: `Curar y calcular Match con IA (${offerCards.length} ofertas)`,
        provider,
        model,
        systemPrompt: buildMatchSystemPrompt({ kind, targetThreshold }),
        userPrompt: buildMatchUserPrompt({ candidateCard, offers: offerCards }),
      };
    }

    if (action === 'outreach') {
      const systemPrompt = `Eres un experto en selección de personal y marca profesional. Tu tarea es generar:
1. Un email o mensaje de contacto corto (outreach) para enviar al reclutador por LinkedIn o email (máximo 150 palabras, tono profesional y persuasivo, adaptado a la vacante y la experiencia del candidato).
2. Una carta de presentación (cover letter) profesional y adaptada estilo Harvard (máximo 300 palabras).
3. Una lista de las 3-5 preguntas técnicas y de comportamiento más probables en una entrevista para esta vacante, junto con consejos clave para responder cada una usando la experiencia del candidato.

Debes responder ÚNICA y EXCLUSIVAMENTE con un objeto JSON válido que contenga las siguientes claves:
{
  "outreachMessage": "...",
  "coverLetter": "...",
  "interviewQuestions": [
    {
      "question": "...",
      "tip": "..."
    }
  ]
}
No uses bloques de código Markdown (sin triple backticks). Responde directamente con el JSON parseable.`;

      const userPrompt = `CV del candidato:
${payload.cvContent || ''}

Oferta de empleo:
Puesto: ${payload.jobTitle || ''}
Empresa: ${payload.company || ''}
Descripción: ${payload.jobDescription || ''}`;

      return {
        actionTitle: `Carta de Presentación y Contacto (${payload.jobTitle || 'Puesto'} - ${payload.company || 'Empresa'})`,
        provider,
        model,
        systemPrompt,
        userPrompt,
      };
    }

    if (action === 'import_cv') {
      const resolvedPrompt = await this.resolvePrompt('import_cv');
      const { systemPrompt, userPrompt: userPromptTemplate, isStrict } = resolvedPrompt;
      const resolvedName = this.extractCandidateName(payload.rawText || '') || payload.candidateName || 'Candidato';
      const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: Identifica el nombre de la persona en el CV (usualmente al principio). El currículum resultante DEBE comenzar obligatoriamente con ese nombre propio en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;
      const finalSystem = systemPrompt + (isStrict ? '\n\n' + MARKDOWN_STRUCTURE_INSTRUCTIONS : '') + nameDirective;
      const finalUser = userPromptTemplate.replace(/\{\{cv\}\}/g, payload.rawText || '');

      return {
        actionTitle: 'Importar y Formatear CV con IA',
        provider,
        model,
        systemPrompt: finalSystem,
        userPrompt: finalUser,
      };
    }

    if (action === 'profile_extract') {
      const systemPrompt = `Eres un Chief Technology Officer (CTO) y Lead AI Recruiter de élite. Tu objetivo es analizar la información, CV o notas de un candidato y estructurar su "Perfil Profesional Maestro & Criterios".
Debes extraer solo lo que el texto demuestra: logros, tecnologías exactas y preferencias. No inventes stacks ni un rol objetivo. El objetivo profesional es opcional.

REGLAS DE SALIDA:
- Devuelve ÚNICA y EXCLUSIVAMENTE un JSON válido (sin triple backticks ni texto antes/después) con la estructura del perfil profesional maestro.`;

      const userPrompt = `A continuación tienes la información bruta / CV / notas del candidato:
---
${(payload.rawText || '').slice(0, 15000)}
---

Por favor, estructura el Perfil Maestro completo en JSON según las instrucciones.`;

      return {
        actionTitle: 'Estructurar Perfil Profesional con IA',
        provider,
        model,
        systemPrompt,
        userPrompt,
      };
    }

    if (action === 'start_interview') {
      const dump = (payload.dumpText || userContext.careerProfile?.bio || '').trim();
      const resolvedClassification = payload.classification || heuristicClassifyCareerProfile(
        [dump, payload.optionalTarget].filter(Boolean).join('\n'),
      );
      const systemPrompt = `Eres un career coach para profesionales de software (y perfiles afines).
Formula 3 preguntas cortas para rellenar HUECOS del texto del candidato.

REGLAS:
- Nicho: desarrollo de software. Adapta frontend/backend/fullstack/mobile/datos/IA/junior/senior según la clasificación.
- Pregunta solo sobre lo que NO está claro en el texto.
- No uses ejemplos de productos inventados ni de un usuario concreto.
- Devuelve ÚNICAMENTE un JSON array:
[{"id":"q1","category":"stack|projects|target","question":"...","hint":"...","suggestedAnswers":[]}]`;

      const userPrompt = `Clasificación: ${JSON.stringify(resolvedClassification)}
Objetivo explícito (opcional): ${payload.optionalTarget?.trim() || 'ninguno'}
Texto / CV / notas:
---
${dump.slice(0, 10000) || 'Vacío'}
---`;

      return {
        actionTitle: 'Generar Preguntas de Entrevista IA',
        provider,
        model,
        systemPrompt,
        userPrompt,
      };
    }

    if (action === 'synthesize_profile') {
      const systemPrompt = `Redactas el perfil maestro de un candidato para matching de ofertas y adaptación de CVs.
Público principal: desarrolladores de software de cualquier seniority. Si el perfil no es software, redacta con honestidad lo que hay.

REGLAS:
- Documento maestro: 250-400 palabras. Quién es, qué ha hecho, con qué tecnología, y el norte SOLO si lo ha dicho.
- NO inventes herramientas, empresas, métricas ni un rol objetivo. Si no dijo "quiero ser X", no lo inventes.
- Devuelve ÚNICAMENTE JSON con el perfil estructurado.`;

      const qaList = Array.isArray(payload.qaList) ? payload.qaList : [];
      const userPrompt = `Clasificación: ${JSON.stringify(payload.classification || {})}
Objetivo explícito opcional: ${payload.optionalTarget?.trim() || 'ninguno'}
Borrador / CV:
---
${(payload.dumpText || userContext.careerProfile?.bio || '').slice(0, 12000)}
---
Perfil previo (JSON):
${JSON.stringify(payload.currentProfile || userContext.careerProfile || {}, null, 2).slice(0, 4000)}

Respuestas de la entrevista:
${qaList.map((qa: any, i: number) => `P${i + 1}: ${qa.question}\nR: ${qa.answer}`).join('\n\n')}`;

      return {
        actionTitle: 'Sintetizar Perfil desde Entrevista IA',
        provider,
        model,
        systemPrompt,
        userPrompt,
      };
    }

    if (action === 'polish_section') {
      const systemPrompt = `Eres un experto redactor de perfiles técnicos y headhunter internacional.
Tu tarea es reescribir y pulir el texto de la sección "${payload.sectionType || 'sección'}" proporcionada por un profesional tech.

DIRECTRICES:
- Si es "bio": Hazla concisa, orientada a impacto y resultados, destacando stack y valor técnico sin caer en clichés corporativos vacíos.
- Si es "curationCriteria": Conviértelo en reglas claras e inequívocas para que un sistema de scoring de ofertas sepa exactamente qué priorizar, qué penalizar y qué descartar.
- Si es "project": Enfatiza arquitectura técnica, problemas resueltos y métricas de impacto (fórmula XYZ).
- Conserva al 100% la verdad de los datos; NO inventes tecnologías que no aparezcan en el texto original.
- Devuelve DIRECTAMENTE el texto pulido en Markdown simple (sin preámbulos ni bloques envolventes de código).`;

      const userPrompt = `Texto actual a pulir:\n${payload.currentContent || ''}`;

      return {
        actionTitle: `Pulir Sección "${payload.sectionType || 'sección'}" con IA`,
        provider,
        model,
        systemPrompt,
        userPrompt,
      };
    }

    return {
      actionTitle: `Acción de IA: ${action}`,
      provider,
      model,
      systemPrompt: 'Prompt no especificado.',
      userPrompt: JSON.stringify(payload, null, 2),
    };
  }
}


