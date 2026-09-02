import { db } from '@/db';
import { settings, prompts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  DEFAULT_FREE_PROVIDER,
  DEFAULT_FREE_MODEL,
  DEFAULT_PRO_PROVIDER,
  DEFAULT_PRO_MODEL,
  getDefaultModelForProvider
} from './models';
import { canAccessFeature } from './subscription';
import { getBuiltInPrompt, type BuiltInPromptKey } from './prompt-defaults';
import {
  buildOfferSignalPrefix,
  detectOfferLanguage,
  enforceCurationConstraints,
  extractLanguageSentences,
  formatHardConstraintsForPrompt,
  isLanguageRuleLine,
  parseHardConstraints,
  type HardConstraints,
} from './curation-constraints';

import {
  genericSoftwareInterviewQuestions,
  heuristicClassifyCareerProfile,
  normalizeClassification,
  type InterviewQuestion,
  type ProfileClassification,
} from './profile-classification';

type CurationOfferInput = {
  id: string;
  title: string;
  company: string;
  description: string | null;
  platform: string;
  scoreOverall?: number | null;
  tldr?: string | null;
  sourceMetadata?: unknown;
};


const MARKDOWN_STRUCTURE_INSTRUCTIONS = `
¡REGLA DE ESTRUCTURA Y FORMATO CRÍTICA PARA EL RENDERIZADO DE PDF!:
Debes devolver el currículum formateado estrictamente bajo las siguientes especificaciones de Markdown para que el motor de PDF pueda parsearlo e imprimirlo correctamente. De lo contrario, se romperá el diseño visual del PDF.

1. NOMBRE DEL CANDIDATO (LA PRIMERÍSIMA LÍNEA DEL DOCUMENTO):
   - La primera línea del documento DEBE ser siempre un título de primer nivel ('# ') con el nombre completo del candidato.
   - Ejemplo exacto:
     # ANGEL PORLAN
   - Debe haber obligatoriamente una línea en blanco después del nombre.

2. ENCABEZADO DE CONTACTO (Inmediatamente después del nombre y antes de cualquier sección '##'):
   - Las líneas de contacto deben estar en una o dos líneas al principio, formateadas usando el separador ' | ' y negrita para los nombres de los campos.
   - Ejemplo exacto:
     **Email:** angelporlandev@gmail.com | **Teléfono:** +34 652 68 49 26 | **Ubicación:** Murcia, España
     **LinkedIn:** linkedin.com/in/angelporlan | **GitHub:** github.com/angelporlan | **Web:** angelporlan.vercel.app

3. SECCIONES PRINCIPALES:
   - Deben empezar siempre con '## ' (ejemplo: ## Experiencia Profesional, ## Educación, ## Habilidades Técnicas, ## Perfil Profesional).

4. ENTRADAS DE EXPERIENCIA, EDUCACIÓN O PROYECTOS (ESTRUCTURA OBLIGATORIA EN DOS LÍNEAS):
   - Cada puesto de trabajo, titulación académica o proyecto DEBE estar estructurado en exactamente DOS líneas consecutivas e independientes (sin líneas en blanco entre ellas):
     - LÍNEA 1 (Título/Puesto): Debe comenzar exactamente con '### ' seguido ÚNICAMENTE del nombre del puesto o título (ejemplo: ### Desarrollador Full Stack). NO incluyas nombres de empresas, de instituciones, fechas, separadores '|' ni formato adicional en la línea que empieza por '### '.
     - LÍNEA 2 (Empresa y Fecha - Línea inmediatamente posterior): Debe contener el nombre de la Empresa o Institución en negrita, seguido exactamente del separador ' | ' (espacio, barra vertical, espacio), seguido del rango de fechas en cursiva.
       Ejemplo exacto:
       ### Desarrollador Full Stack
       **ENAE Business School** | *Abril 2025 – Presente*
       
       Ejemplo exacto:
       ### Técnico Superior en Desarrollo de Aplicaciones Web (DAW)
       **IES Ramón Arcas Meca** | *2022 – 2024*

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
    try {
      const [setting] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);
      return setting ? setting.value : defaultValue;
    } catch (e) {
      console.error(`[AIService] Error al leer setting "${key}" de la DB. Usando default "${defaultValue}":`, e);
      return defaultValue;
    }
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
        ? "Eres un redactor experto de CVs estilo Harvard. Toma el siguiente CV Base y optimízalo detalladamente para encajar con los requisitos de la Oferta de Trabajo. Incrementa el match semántico, prioriza secciones relevantes y utiliza el método STAR para describir logros. Devuelve la salida en Markdown limpio sin bloques de código tipo triple backtick."
        : "Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (método STAR) basados en la experiencia real provista en el CV Base. No inventes experiencias que no estén en el CV base, solo optimiza la redacción y priorización de las mismas. Devuelve el resultado exclusivamente en formato Markdown estructurado válido, sin bloques de código ni explicaciones.";

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
        ? "Eres un redactor experto de CVs estilo Harvard. Toma el siguiente CV Base y optimízalo detalladamente para encajar con los requisitos de la Oferta de Trabajo. Incrementa el match semántico, prioriza secciones relevantes y utiliza el método STAR para describir logros. Devuelve la salida en Markdown limpio sin bloques de código tipo triple backtick."
        : "Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (método STAR) basados en la experiencia real provista en el CV Base. No inventes experiencias que no estén en el CV base, solo optimiza la redacción y priorización de las mismas. Devuelve el resultado exclusivamente en formato Markdown estructurado válido, sin bloques de código ni explicaciones.";

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
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de OpenRouter (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error("La respuesta recibida de OpenRouter no tiene el formato esperado.");
      }
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
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de DeepSeek (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
      if (!data.choices || data.choices.length === 0 || !data.choices[0].message) {
        throw new Error("La respuesta recibida de DeepSeek no tiene el formato esperado.");
      }
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
      const response = await fetch(
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
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de Gemini (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    });

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

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
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
    });

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

    const response = await fetch(
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
      }
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

  static async analyzeSTARStream({
    cvMarkdown,
    jobDescription,
    company,
    userSubscriptionStatus,
    mcpProfile
  }: {
    cvMarkdown: string;
    jobDescription: string;
    company: string;
    userSubscriptionStatus: string;
    mcpProfile?: any;
  }): Promise<ReadableStream<Uint8Array>> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    
    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER)
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    // El prompt integrado se usa siempre como fallback; la DB solo puede
    // aportar una sobrescritura completa y válida.
    const dbPrompt = await this.resolvePrompt('star_analyze');

    const defaultSystem = `Eres un reclutador senior experto de la empresa "{{company}}". Tu tarea es evaluar el currículum del candidato contra la descripción de la oferta de trabajo y responder con un objeto JSON estructurado que contenga un análisis exhaustivo.
Es crítico que respondas única y exclusivamente con el objeto JSON válido, sin preámbulos, sin explicaciones, sin comentarios y sin bloques de código Markdown (no uses triple backticks \`\`\`json). Tu respuesta debe ser directamente parseable por JSON.parse.`;

    const defaultUser = `CV del candidato:
{{cv}}

Descripción de la oferta de trabajo:
{{job}}

Actua como un reclutador senior de esta empresa exacta, analiza mi cv contra esta descripcion de referencia y dame una puntuacion de match sobre 100, las cinco palabras clave que me faltan y las 3 redflags que un responsable de selección pillaría en menos de 10 segundos.

CRÍTICO: El siguiente JSON es una plantilla estructural de ejemplo. Debes rellenar todos los campos basándote única y exclusivamente en tu análisis real del CV y de la oferta proporcionados. NO copies bajo ningún concepto los valores de ejemplo (como tecnologías, años o la puntuación '38'). Genera una evaluación original basada al 100% en los datos reales del CV y la oferta.

Responde exactamente con este formato JSON:
{
  "score": 0,
  "scoreLabel": "Ejemplo: Match Alto / Match Medio / Match Bajo",
  "scoreReason": "Ejemplo de justificación detallada y resumida de la puntuación en base a las coincidencias y diferencias reales encontradas.",
  "dimensions": [
    { "name": "Ejemplo Dimensión 1", "percentage": 0 },
    { "name": "Ejemplo Dimensión 2", "percentage": 0 }
  ],
  "missingKeywords": [
    "Ejemplo Palabra Clave Requerida Faltante 1",
    "Ejemplo Palabra Clave Requerida Faltante 2"
  ],
  "presentKeywords": [
    "Ejemplo Palabra Clave Requerida Presente 1",
    "Ejemplo Palabra Clave Requerida Presente 2"
  ],
  "redFlags": [
    {
      "title": "Ejemplo de Alerta 1",
      "description": "Ejemplo de por qué se considera una alerta de criba en base a la comparación real."
    }
  ],
  "verdict": "Ejemplo de veredicto final detallado e imparcial del reclutador."
}`;

    let systemPrompt = dbPrompt?.systemPrompt || defaultSystem;
    // Reemplazar la variable {{company}} en el systemPrompt si está presente
    systemPrompt = systemPrompt.replace(/\{\{company\}\}/g, company);

    // Inyectar contexto dinámico del perfil MCP del usuario si existe
    if (mcpProfile) {
      let profileContext = '\n\nINFORMACIÓN Y PREFERENCIAS DEL CANDIDATO (ÚSALAS PARA CALCULAR LA PUNTUACIÓN DE MATCH, VEREDICTO Y REDFLAGS):';
      if (mcpProfile.targetRoles && Array.isArray(mcpProfile.targetRoles) && mcpProfile.targetRoles.length > 0) {
        profileContext += `\n- Roles y tecnologías objetivo: ${mcpProfile.targetRoles.join(', ')}`;
      }
      if (mcpProfile.experienceYears !== undefined && mcpProfile.experienceYears !== null) {
        profileContext += `\n- Años de experiencia real del candidato: ${mcpProfile.experienceYears} años`;
      }
      if (mcpProfile.salaryMin || mcpProfile.salaryTarget) {
        profileContext += `\n- Rango de salario pretendido: Min: ${mcpProfile.salaryMin || 'No especificado'} EUR/año, Target: ${mcpProfile.salaryTarget || 'No especificado'} EUR/año`;
      }
      if (mcpProfile.locations && Array.isArray(mcpProfile.locations) && mcpProfile.locations.length > 0) {
        profileContext += '\n- Puntuaciones de preferencia geográfica y modalidad (1.0 = rechazo, 5.0 = ideal):';
        mcpProfile.locations.forEach((loc: any) => {
          if (loc.name && loc.score !== undefined) {
            profileContext += `\n  * ${loc.name}: ${loc.score}/5.0`;
          }
        });
      }
      if (mcpProfile.experienceFitRules) {
        profileContext += '\n- Reglas de puntuación para años de experiencia requeridos por la oferta (1.0 = pésimo fit, 5.0 = fit ideal):';
        Object.entries(mcpProfile.experienceFitRules).forEach(([key, val]) => {
          profileContext += `\n  * Requisito de ${key} de experiencia: Puntuación ${val}/5.0`;
        });
      }
      if (mcpProfile.masterDocument) {
        profileContext += `\n- Perfil maestro:\n${String(mcpProfile.masterDocument).slice(0, 2500)}`;
      } else if (mcpProfile.bio) {
        profileContext += `\n- Trayectoria: ${String(mcpProfile.bio).slice(0, 1200)}`;
      }
      if (mcpProfile.additionalNotes && !mcpProfile.masterDocument) {
        profileContext += `\n- Notas adicionales de trayectoria y negociación: ${mcpProfile.additionalNotes}`;
      }

      profileContext += `\n\nREGLA CRÍTICA DE EVALUACIÓN: Evalúa cada dimensión y el score global considerando ESTAS preferencias y el CV. Por ejemplo, si la oferta exige más años de experiencia de los que el candidato tiene, o si la ubicación/salario no encajan con sus preferencias, la puntuación de match en esa dimensión debe bajar drásticamente. Justifica cada Red Flag y desajuste según este perfil del usuario.`;

      systemPrompt += profileContext;
    }

    // Asegurar que devuelva la estructura de puntuación scoreBreakdown en el JSON
    systemPrompt += `\n\nCRÍTICO: Debes incluir un campo adicional llamado "scoreBreakdown" en la raíz de tu respuesta JSON con puntuaciones numéricas de 1.0 a 5.0 para cada una de estas dimensiones:
- "tech_stack": Alineación técnica.
- "experience_fit": Ajuste de años de experiencia.
- "salary_fit": Alineación salarial.
- "culture_alignment": Fit cultural y organizacional.
- "work_mode": Fit geográfico y modalidad de trabajo.

Ejemplo de cómo debe ser esta sección en tu JSON:
  "scoreBreakdown": {
    "tech_stack": 4.2,
    "experience_fit": 5.0,
    "salary_fit": 3.5,
    "culture_alignment": 4.0,
    "work_mode": 4.5
  }`;

    let userPromptTemplate = dbPrompt?.userPrompt || defaultUser;
    const userPrompt = userPromptTemplate
      .replace(/\{\{cv\}\}/g, cvMarkdown)
      .replace(/\{\{job\}\}/g, jobDescription);

    if (provider === 'gemini') {
      return await this.streamGeminiOficial(cvMarkdown, jobDescription, model, systemPrompt, userPrompt);
    } else if (provider === 'deepseek') {
      return await this.streamDeepSeekOficial(cvMarkdown, jobDescription, model, systemPrompt, userPrompt);
    } else {
      return await this.streamOpenRouter(cvMarkdown, jobDescription, model, systemPrompt, userPrompt);
    }
  }

  static async optimizeSTARStream({
    cvMarkdown,
    jobDescription,
    company,
    jobTitle,
    missingKeywords,
    redFlags,
    userSubscriptionStatus,
    candidateName,
    promptId
  }: {
    cvMarkdown: string;
    jobDescription: string;
    company: string;
    jobTitle: string;
    missingKeywords: string[];
    redFlags: { title: string; description: string }[];
    userSubscriptionStatus: string;
    candidateName?: string;
    promptId?: string;
  }): Promise<ReadableStream<Uint8Array>> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    
    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER)
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    const resolvedName = this.extractCandidateName(cvMarkdown) || candidateName || "Candidato";
    const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: El currículum DEBE comenzar obligatoriamente con el nombre del candidato en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;

    // El prompt integrado se usa siempre como fallback; la DB solo puede
    // aportar una sobrescritura completa y válida.
    const dbPrompt = await this.resolvePrompt('star_optimize', promptId);

    const defaultSystem = `Eres un redactor experto en CVs estilo Harvard. Tu objetivo es optimizar el currículum del candidato para la oferta de empleo de "{{jobTitle}}" en la empresa "{{company}}".
Debes reescribir la sección de experiencia laboral del candidato de acuerdo con las instrucciones provistas por el usuario.
Debes devolver la salida únicamente en formato Markdown (.MD) válido y limpio. No incluyas explicaciones, no agregues preámbulos ni comentarios finales, y no envuelvas la respuesta en bloques de código triple acento grave (\`\`\` o \`\`\`markdown). Tu respuesta completa debe ser directamente el currículum parseable.

CRÍTICO: EVITA DELATORES DE IA (PATRONES REPETITIVOS)
- Evita el exceso de números y porcentajes: No inventes ni metas métricas numéricas o porcentajes en cada viñeta. Deja como máximo 1 o 2 métricas numéricas potentes por cada puesto para que destaquen de verdad. Las demás viñetas deben describir impacto, tecnologías o responsabilidades de forma natural y cualitativa.
- Varía el tipo de métrica: Alterna entre porcentajes, volumen bruto (ej. "más de X usuarios"), tiempo ahorrado o impacto cualitativo relevante.
- Cambia la estructura: No pongas siempre la métrica al final de la frase (evita finalizar todo con "...mejorando un X%"). Intégrala de forma fluida y natural.
- El resultado debe sonar profesional, humano y escrito por un profesional maduro, no una lista geométrica y matemática de IA.`;

    const defaultUser = `Aquí tienes mi CV actual:
{{cv}}

Aquí tienes la descripción de la oferta:
{{job}}

Estas son las palabras clave esenciales que me faltan:
{{keywords}}

Estas son las Red Flags identificadas que debo eliminar o mitigar:
{{redflags}}

Por favor, reescribe mi sección de experiencia añadiendo esas palabras clave y eliminando o mitigando esas redflags. Usa la fórmula XYZ de Google: 'Logré X medido por Y haciendo Z'. Actúa como filtro ATS y como un responsable de selección que lee 200 cv de golpe. Escanea mi nuevo cv y dime qué secciones saltaría y reescribelas para que paren el scroll.`;

    let systemPrompt = dbPrompt?.systemPrompt || defaultSystem;
    systemPrompt = systemPrompt
      .replace(/\{\{company\}\}/g, company)
      .replace(/\{\{jobTitle\}\}/g, jobTitle);

    if (dbPrompt) {
      if (dbPrompt.isStrict) {
        systemPrompt += "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + nameDirective;
      } else {
        systemPrompt += "\n\n" + nameDirective;
      }
    } else {
      systemPrompt += "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + nameDirective;
    }

    const keywordsList = missingKeywords.join(', ');
    const redFlagsList = redFlags.map(rf => `- ${rf.title}: ${rf.description}`).join('\n');

    let userPromptTemplate = dbPrompt?.userPrompt || defaultUser;
    const userPrompt = userPromptTemplate
      .replace(/\{\{cv\}\}/g, cvMarkdown)
      .replace(/\{\{job\}\}/g, jobDescription)
      .replace(/\{\{keywords\}\}/g, keywordsList)
      .replace(/\{\{redflags\}\}/g, redFlagsList);

    if (provider === 'gemini') {
      return await this.streamGeminiOficial(cvMarkdown, jobDescription, model, systemPrompt, userPrompt);
    } else if (provider === 'deepseek') {
      return await this.streamDeepSeekOficial(cvMarkdown, jobDescription, model, systemPrompt, userPrompt);
    } else {
      return await this.streamOpenRouter(cvMarkdown, jobDescription, model, systemPrompt, userPrompt);
    }
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
Asesor de empleo IA optimizado mediante **${providerName}** para encajar con el puesto requerido. Match semántico incrementado, enfoque basado en logros cuantificables y método STAR para resaltar impacto empresarial.

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

  static async analyzeFailures({ targetOffersText, userSubscriptionStatus }: { targetOffersText: string; userSubscriptionStatus: string }): Promise<string> {
    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    const provider = await this.getSetting(isPro ? 'pro_provider' : 'free_provider', isPro ? DEFAULT_FREE_PROVIDER : DEFAULT_FREE_PROVIDER);
    const model = await this.getSetting(isPro ? 'pro_model' : 'free_model', getDefaultModelForProvider(isPro ? 'pro' : 'free', provider));

    const resolvedPrompt = await this.resolvePrompt('analyze_failures');
    const { systemPrompt, userPrompt: userPromptTemplate } = resolvedPrompt;

    const finalUserPrompt = userPromptTemplate.replace(/\{\{report\}\}/g, targetOffersText);

    try {
      if (provider === 'gemini') {
        return await this.callGeminiOficial('', '', model, systemPrompt, finalUserPrompt);
      } else if (provider === 'deepseek') {
        return await this.callDeepSeekOficial('', '', model, systemPrompt, finalUserPrompt);
      } else {
        return await this.callOpenRouter('', '', model, systemPrompt, finalUserPrompt);
      }
    } catch (err) {
      console.warn("[AIService.analyzeFailures] Provider call failed. Falling back to offline local simulation:", err);
      return this.getMockFailureAnalysis(targetOffersText);
    }
  }

  private static getMockFailureAnalysis(targetOffersText: string): string {
    const countOccurrences = (str: string, word: string) => {
      const regex = new RegExp(word, 'gi');
      return (str.match(regex) || []).length;
    };

    const totalOffers = countOccurrences(targetOffersText, 'Puesto:') || countOccurrences(targetOffersText, 'Job Title:') || 3;
    const rejectedOffers = countOccurrences(targetOffersText, 'Rechazado') || countOccurrences(targetOffersText, 'Rejected') || 0;
    const interviewOffers = countOccurrences(targetOffersText, 'Entrevista') || countOccurrences(targetOffersText, 'Interview') || 0;
    const appliedOffers = countOccurrences(targetOffersText, 'Postulado') || countOccurrences(targetOffersText, 'Applied') || 0;

    let analysis = `## Diagnóstico de tu Embudo de Candidaturas (Modo de Contingencia Local)

Detecto problemas en la conexión de red local con el proveedor de IA. He generado un diagnóstico estático local de tu embudo de candidaturas actuales para ayudarte:

### 1. Estado del Embudo
Tienes un total de **${totalOffers} candidaturas** registradas:
- **${appliedOffers}** en fase de Postulado.
- **${interviewOffers}** en fase de Entrevista.
- **${rejectedOffers}** Rechazadas.

### 2. Principales Áreas de Fricción Identificadas
${rejectedOffers > 0 
  ? `- **Tasa de Rechazo Inicial:** Tienes ${rejectedOffers} candidaturas rechazadas. Esto suele apuntar a una incompatibilidad de palabras clave en la criba inicial del ATS. Revisa si tus CVs vinculados están incluyendo las habilidades técnicas exigidas en la sección de requisitos.`
  : `- **Falta de Volumen en el Embudo:** Tienes un embudo relativamente pequeño (${totalOffers} ofertas). El reclutamiento es un juego de conversión; te sugiero añadir al menos 5-10 postulaciones adicionales en la columna de *Interés* para iniciar el análisis semántico de IA con más referencias.`}

- **Falta de Métricas de Impacto (Fórmula XYZ):** Al analizar tus candidaturas, se observa que los currículums vinculados describen responsabilidades técnicas en lugar de logros. En lugar de *"Desarrollo de APIs con Node.js"*, deberías estructurarlo como: *"Optimicé el tiempo de respuesta en un 30% rediseñando el backend mediante Node.js y Drizzle ORM en producción"*.

- **Vínculos de Currículum:** Asegúrate de vincular currículums específicos optimizados para cada candidatura. Las postulaciones sin currículum personalizado reducen la tasa de conversión en criba manual en más de un 60%.

### 3. Plan de Acción Recomendado
1. **Audita tus palabras clave:** Entra en la tarjeta de las ofertas, pulsa "Vincular CV" y genera una optimización semántica (Modo Adaptado u Honesto) para inyectar los términos ausentes.
2. **Prepara Historias STAR:** Para las candidaturas en fase de *Entrevista*, accede a sus detalles y revisa las preguntas y respuestas STAR generadas por la IA para preparar tus entrevistas técnicas y de comportamiento.
3. **Optimiza la descripción del puesto:** Asegúrate de que las descripciones que pegas de las ofertas en Matchply incluyan el stack técnico completo para que nuestro analizador ATS sea 100% preciso.`;

    return analysis;
  }

  /**
   * Curación masiva optimizada:
   * - Micro-lotes de 2 ofertas (reduce "lost in the middle")
   * - Concurrencia limitada en paralelo
   * - JD/CV comprimidos
   * - Checklist de reglas + enforcement en código
   */
  static async curateOffersBatch({
    baseCvMarkdown,
    userCareerProfile,
    offers,
    userSubscriptionStatus,
    targetThreshold = 65,
    onBatchComplete,
  }: {
    baseCvMarkdown: string;
    userCareerProfile?: any;
    offers: CurationOfferInput[];
    userSubscriptionStatus: string;
    targetThreshold?: number;
    onBatchComplete?: (items: Array<{
      id: string;
      title: string;
      company: string;
      score: number;
      decision: 'keep' | 'archive';
      fitReason: string;
      highlightSkills?: string[];
    }>) => void | Promise<void>;
  }): Promise<{
    curated: Array<{
      id: string;
      title: string;
      company: string;
      score: number;
      decision: 'keep' | 'archive';
      fitReason: string;
      highlightSkills?: string[];
    }>;
  }> {
    if (!offers || offers.length === 0) {
      return { curated: [] };
    }

    const MICRO_BATCH_SIZE = 2;
    const MAX_CONCURRENCY = 4;

    const isPro = canAccessFeature(userSubscriptionStatus, 'advancedAi');
    const provider = await this.getSetting(
      isPro ? 'pro_provider' : 'free_provider',
      isPro ? DEFAULT_PRO_PROVIDER : DEFAULT_FREE_PROVIDER,
    );
    const model = await this.getSetting(
      isPro ? 'pro_model' : 'free_model',
      getDefaultModelForProvider(isPro ? 'pro' : 'free', provider),
    );

    const userCurationRules = (userCareerProfile?.curationCriteria || '').trim();
    const hardConstraints = parseHardConstraints({
      curationCriteria: userCareerProfile?.curationCriteria,
      bio: userCareerProfile?.bio,
    });
    const ruleChecklist = this.extractCurationRuleChecklist(userCurationRules);
    const candidateContext = this.buildCurationCandidateContext(
      userCareerProfile,
      baseCvMarkdown,
      hardConstraints,
    );
    const systemPrompt = this.buildCurationSystemPrompt(
      userCurationRules,
      ruleChecklist,
      targetThreshold,
      hardConstraints,
    );

    const batches: typeof offers[] = [];
    for (let i = 0; i < offers.length; i += MICRO_BATCH_SIZE) {
      batches.push(offers.slice(i, i + MICRO_BATCH_SIZE));
    }

    const batchResults = await this.mapWithConcurrency(batches, MAX_CONCURRENCY, async (batch) => {
      let curatedBatch: Array<{
        id: string;
        title: string;
        company: string;
        score: number;
        decision: 'keep' | 'archive';
        fitReason: string;
        highlightSkills?: string[];
      }>;
      try {
        curatedBatch = await this.curateOffersMicroBatch({
          batch,
          candidateContext,
          systemPrompt,
          provider,
          model,
          targetThreshold,
          hardConstraints,
        });
      } catch (err) {
        console.warn('[AIService.curateOffersBatch] Micro-batch failed, using fallback for batch:', err);
        curatedBatch = batch.map((offer) => this.fallbackCurateItem(offer, targetThreshold, hardConstraints));
      }

      if (onBatchComplete) {
        await onBatchComplete(curatedBatch);
      }
      return curatedBatch;
    });

    const resultsMap = new Map<string, {
      id: string;
      title: string;
      company: string;
      score: number;
      decision: 'keep' | 'archive';
      fitReason: string;
      highlightSkills?: string[];
    }>();

    for (const batch of batchResults) {
      for (const item of batch) {
        resultsMap.set(item.id, item);
      }
    }

    const curated = offers.map((offer) =>
      resultsMap.get(offer.id) || this.fallbackCurateItem(offer, targetThreshold, hardConstraints)
    );

    return { curated };
  }

  private static extractCurationRuleChecklist(criteria: string): string[] {
    if (!criteria.trim()) return [];

    const lines = criteria
      .split(/\n+/)
      .flatMap((line) => line.split(/(?<=[.!;])\s+(?=(?:[-*•⛔]|Si\b|Prioriza\b|Penaliza\b|Descarta\b|Evita\b|No\b|Must\b|Reject\b))/i))
      .map((line) => line.replace(/^[\s\-*$•\d.)]+/, '').replace(/^⛔\s*/, '').trim())
      .filter((line) => line.length >= 10);

    const unique: string[] = [];
    for (const line of lines) {
      if (!unique.some((u) => u.toLowerCase() === line.toLowerCase())) {
        unique.push(line.slice(0, isLanguageRuleLine(line) ? 500 : 180));
      }
    }
    return unique.slice(0, 16);
  }

  private static compressCvForCuration(markdown: string, maxChars = 900): string {
    if (!markdown) return '';
    const cleaned = markdown.replace(/\s+/g, ' ').trim();
    const skillsMatch = markdown.match(/##[^\n]*(habilidades|skills|tecnolog)[^\n]*\n([\s\S]*?)(?=\n## |\n# |$)/i);
    const skillsBlock = skillsMatch
      ? skillsMatch[0].replace(/\s+/g, ' ').trim().slice(0, 400)
      : '';
    const head = cleaned.slice(0, Math.max(0, maxChars - (skillsBlock ? skillsBlock.length + 20 : 0)));
    return skillsBlock ? `${head}\n[Skills]: ${skillsBlock}` : head;
  }

  private static compressJobDescription(
    description: string | null | undefined,
    title?: string | null,
    sourceMetadata?: unknown,
    maxChars = 900,
  ): string | undefined {
    const text = (description || '').replace(/\s+/g, ' ').trim();
    const prefix = buildOfferSignalPrefix({ title, description, sourceMetadata });
    const languageSentences = extractLanguageSentences(description);
    if (!text && !prefix) return undefined;

    const snippet = text.slice(0, maxChars);
    const parts = [
      prefix,
      languageSentences ? `[idioma_jd]: ${languageSentences}` : '',
      snippet,
    ].filter(Boolean);

    return parts.join(' ');
  }

  private static buildCurationCandidateContext(
    userCareerProfile: any,
    baseCvMarkdown: string,
    hardConstraints?: HardConstraints,
  ): string {
    let candidateContext = '';
    if (userCareerProfile && (userCareerProfile.bio || userCareerProfile.targetRoles || userCareerProfile.curationCriteria || userCareerProfile.keyProjects || userCareerProfile.techStack || userCareerProfile.masterDocument)) {
      candidateContext += `### PERFIL DEL CANDIDATO:\n`;
      if (userCareerProfile.masterDocument) {
        candidateContext += `${String(userCareerProfile.masterDocument).slice(0, 3000)}\n\n`;
      } else {
        if (userCareerProfile.bio) {
          candidateContext += `- Trayectoria & Stack: ${String(userCareerProfile.bio).slice(0, 2000)}\n`;
        }
        if (userCareerProfile.keyProjects && Array.isArray(userCareerProfile.keyProjects) && userCareerProfile.keyProjects.length > 0) {
          const projectsSummary = userCareerProfile.keyProjects
            .map((p: any) => `${p.title || 'Proyecto'} (${p.techStack || ''}): ${p.description || ''}${p.impact ? ` [Impacto: ${p.impact}]` : ''}`)
            .join('; ');
          candidateContext += `- Proyectos Clave & Logros: ${projectsSummary.slice(0, 1500)}\n`;
        }
        if (userCareerProfile.techStack) {
          const stackFormatted = typeof userCareerProfile.techStack === 'object'
            ? Object.entries(userCareerProfile.techStack)
                .map(([cat, items]) => `${cat}: ${Array.isArray(items) ? items.join(', ') : items}`)
                .join(' | ')
            : String(userCareerProfile.techStack);
          candidateContext += `- Tech Stack: ${stackFormatted.slice(0, 600)}\n`;
        }
        if (userCareerProfile.targetTransition) {
          const trans = typeof userCareerProfile.targetTransition === 'object'
            ? `Rol: ${userCareerProfile.targetTransition.targetRole || ''}, Industria: ${userCareerProfile.targetTransition.targetIndustries || ''}, Geografía: ${userCareerProfile.targetTransition.targetGeography || ''}`
            : String(userCareerProfile.targetTransition);
          candidateContext += `- Objetivo de Transición: ${trans}\n`;
        }
      }
      if (userCareerProfile.targetRoles?.length) {
        const roles = Array.isArray(userCareerProfile.targetRoles)
          ? userCareerProfile.targetRoles.join(', ')
          : userCareerProfile.targetRoles;
        candidateContext += `- Roles Objetivo: ${roles}\n`;
      }
      if (userCareerProfile.experienceYears !== undefined && userCareerProfile.experienceYears !== null) {
        candidateContext += `- Años de Experiencia: ${userCareerProfile.experienceYears}\n`;
      }
      if (userCareerProfile.preferredWorkplaces?.length) {
        const modes = Array.isArray(userCareerProfile.preferredWorkplaces)
          ? userCareerProfile.preferredWorkplaces.join(', ')
          : userCareerProfile.preferredWorkplaces;
        candidateContext += `- Modalidades: ${modes}\n`;
      }
      if (userCareerProfile.preferredLocations) {
        candidateContext += `- Ubicaciones: ${userCareerProfile.preferredLocations}\n`;
      }
      if (userCareerProfile.companyPreferences) {
        candidateContext += `- Empresas: ${String(userCareerProfile.companyPreferences).slice(0, 220)}\n`;
      }
      if (userCareerProfile.salaryMin || userCareerProfile.salaryTarget) {
        candidateContext += `- Salario: Min ${userCareerProfile.salaryMin || 'N/D'}€, Target ${userCareerProfile.salaryTarget || 'N/D'}€\n`;
      }
    }

    if (userCareerProfile?.curationCriteria) {
      candidateContext += `\n### CRITERIOS DEL CANDIDATO (texto completo):\n${String(userCareerProfile.curationCriteria).slice(0, 2500)}\n`;
    }

    const extractedRules = formatHardConstraintsForPrompt(hardConstraints);
    if (extractedRules) {
      candidateContext += `\n${extractedRules}\n`;
    }

    const cvSummary = this.compressCvForCuration(baseCvMarkdown);
    if (cvSummary) {
      candidateContext += `\n### CV (resumen):\n${cvSummary}\n`;
    }

    return candidateContext.trim() || 'Perfil general de Desarrollo de Software.';
  }

  private static buildCurationSystemPrompt(
    userCurationRules: string,
    ruleChecklist: string[],
    targetThreshold: number,
    hardConstraints?: HardConstraints,
  ): string {
    const checklistBlock = ruleChecklist.length
      ? ruleChecklist.map((r, i) => `${i + 1}. ${r}`).join('\n')
      : (userCurationRules || '(sin reglas personalizadas explícitas)');

    const extractedRules = formatHardConstraintsForPrompt(hardConstraints);

    return `Eres un asesor de selección de Matchply. Triage RIGUROSO de pocas ofertas frente al perfil del candidato.

PROTOCOLO OBLIGATORIO POR OFERTA:
1) HARD RULES primero: revisa CADA ítem del checklist. Si viola alguno → score ≤ 30 y decision="archive".
2) El IDIOMA DE REDACCIÓN de la oferta es HARD RULE. Usa la señal idioma_oferta. Si el candidato rechaza o penaliza ofertas en inglés y la oferta está en inglés, DEBES incluirlo en violatedRules y NO dar scores altos aunque el stack encaje.
3) Solo si NO viola reglas: evalúa stack, modalidad, salario, experiencia y tipo de empresa.
4) score 0-100 entero. decision "keep" si score>=${targetThreshold}, si no "archive".
5) fitReason: 1 frase ≤25 palabras. Si hay violación, nómbrala.

⛔ CHECKLIST DE REGLAS DURAS (prioridad absoluta):
${checklistBlock}
${extractedRules ? `\n${extractedRules}\n` : ''}
Responde SOLO JSON válido:
{
  "curated": [
    {
      "id": "ID",
      "score": 85,
      "decision": "keep",
      "fitReason": "...",
      "highlightSkills": ["Skill1", "Skill2"],
      "rulesChecked": ["1", "2"],
      "violatedRules": []
    }
  ]
}
Si violatedRules no está vacío, score DEBE ser ≤30 y decision="archive".`;
  }

  private static async curateOffersMicroBatch({
    batch,
    candidateContext,
    systemPrompt,
    provider,
    model,
    targetThreshold,
    hardConstraints,
  }: {
    batch: CurationOfferInput[];
    candidateContext: string;
    systemPrompt: string;
    provider: string;
    model: string;
    targetThreshold: number;
    hardConstraints: HardConstraints;
  }) {
    const simplifiedOffers = batch.map((o) => {
      const meta = o.sourceMetadata && typeof o.sourceMetadata === 'object'
        ? o.sourceMetadata as Record<string, unknown>
        : {};
      return {
        id: o.id,
        title: o.title,
        company: o.company,
        platform: o.platform,
        tldr: o.tldr ? String(o.tldr).slice(0, 220) : undefined,
        workplaceType: typeof meta.workplaceType === 'string' ? meta.workplaceType : undefined,
        location: typeof meta.location === 'string' ? meta.location : undefined,
        descriptionSnippet: this.compressJobDescription(o.description, o.title, o.sourceMetadata),
      };
    });

    const userPrompt = `${candidateContext}

### OFERTAS A EVALUAR (${simplifiedOffers.length}):
${JSON.stringify(simplifiedOffers)}

Evalúa PRIMERO el checklist de reglas duras (rellena rulesChecked y violatedRules).
Si idioma_oferta es ingles y el candidato penaliza o rechaza inglés, violatedRules DEBE incluir esa regla.
Devuelve JSON con exactamente estas ${simplifiedOffers.length} ofertas.`;

    let rawResponse = '';
    if (provider === 'gemini') {
      rawResponse = await this.callGeminiOficial('', '', model, systemPrompt, userPrompt);
    } else if (provider === 'deepseek') {
      rawResponse = await this.callDeepSeekOficial('', '', model, systemPrompt, userPrompt);
    } else {
      rawResponse = await this.callOpenRouter('', '', model, systemPrompt, userPrompt);
    }

    const parsed = this.parseCurationJson(rawResponse);
    if (!parsed || !Array.isArray(parsed.curated)) {
      throw new Error('Invalid curation JSON');
    }

    const resultsMap = new Map<string, any>(parsed.curated.map((c: any) => [c.id, c]));

    return batch.map((offer) => {
      const evalResult = resultsMap.get(offer.id);
      return this.normalizeCuratedItem(offer, evalResult, targetThreshold, hardConstraints);
    });
  }

  private static parseCurationJson(rawResponse: string): { curated?: any[] } | null {
    let cleanJson = (rawResponse || '').trim();
    if (!cleanJson) return null;

    if (cleanJson.includes('```')) {
      const start = cleanJson.indexOf('{');
      const end = cleanJson.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleanJson = cleanJson.slice(start, end + 1);
      }
    } else {
      const start = cleanJson.indexOf('{');
      const end = cleanJson.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        cleanJson = cleanJson.slice(start, end + 1);
      }
    }

    try {
      return JSON.parse(cleanJson);
    } catch {
      return null;
    }
  }

  private static normalizeCuratedItem(
    offer: CurationOfferInput,
    evalResult: any,
    targetThreshold: number,
    hardConstraints: HardConstraints,
  ): {
    id: string;
    title: string;
    company: string;
    score: number;
    decision: 'keep' | 'archive';
    fitReason: string;
    highlightSkills?: string[];
  } {
    const rawScore = typeof evalResult?.score === 'number' && Number.isFinite(evalResult.score)
      ? evalResult.score
      : 50;

    const violatedRules = Array.isArray(evalResult?.violatedRules)
      ? evalResult.violatedRules.map((r: unknown) => String(r).trim()).filter(Boolean)
      : [];

    const offerLanguage = detectOfferLanguage({
      title: offer.title,
      description: offer.description,
      sourceMetadata: offer.sourceMetadata,
    });

    const llmDecision =
      evalResult?.decision === 'keep' || evalResult?.decision === 'archive'
        ? evalResult.decision
        : undefined;

    const llmReason = typeof evalResult?.fitReason === 'string' && evalResult.fitReason.trim()
      ? evalResult.fitReason.trim()
      : undefined;

    const enforced = enforceCurationConstraints({
      score: rawScore,
      decision: llmDecision,
      fitReason: llmReason,
      violatedRules,
      offerLanguage,
      constraints: hardConstraints,
      targetThreshold,
    });

    return {
      id: offer.id,
      title: offer.title,
      company: offer.company,
      score: enforced.score,
      decision: enforced.decision,
      fitReason: enforced.fitReason,
      highlightSkills: Array.isArray(evalResult?.highlightSkills)
        ? evalResult.highlightSkills.map((s: unknown) => String(s)).filter(Boolean).slice(0, 4)
        : [],
    };
  }

  private static fallbackCurateItem(
    offer: CurationOfferInput,
    targetThreshold: number,
    hardConstraints: HardConstraints,
  ) {
    const existingScore = offer.scoreOverall
      ? (offer.scoreOverall > 5 ? Math.round(offer.scoreOverall) : Math.round(offer.scoreOverall * 20))
      : 60;

    const offerLanguage = detectOfferLanguage({
      title: offer.title,
      description: offer.description,
      sourceMetadata: offer.sourceMetadata,
    });

    const enforced = enforceCurationConstraints({
      score: existingScore,
      offerLanguage,
      constraints: hardConstraints,
      targetThreshold,
      fitReason: `Evaluación de respaldo para ${offer.title}.`,
    });

    return {
      id: offer.id,
      title: offer.title,
      company: offer.company,
      score: enforced.score,
      decision: enforced.decision,
      fitReason: enforced.fitReason,
      highlightSkills: [offer.platform, offer.company].filter(Boolean).slice(0, 2),
    };
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
  "masterDocument": "..."
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
      return JSON.parse(clean);
    } catch (e) {
      console.error('[AIService.extractProfileFromRawText] Error parsing JSON:', e, 'Raw:', rawResponse);
      return {
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
{"bio":"...","experienceYears":null,"targetRoles":[],"techStack":{"frontend":[],"backend":[],"ai_ml":[],"cloud_devops":[],"database":[]},"keyProjects":[],"targetTransition":{"targetRole":"","targetIndustries":"","targetGeography":""},"preferredWorkplaces":[],"preferredLocations":"","companyPreferences":"","salaryMin":null,"salaryTarget":null,"curationCriteria":"","masterDocument":"..."}`;

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
      return JSON.parse(clean);
    } catch (e) {
      console.error('[AIService.synthesizeProfileFromInterview] Error parsing JSON:', e, 'Raw:', rawResponse);
      const combined = [
        dumpText || currentProfile?.bio || '',
        ...qaList.map((qa) => qa.answer),
      ].filter(Boolean).join('\n\n');
      return {
        ...currentProfile,
        bio: (dumpText || currentProfile?.bio || combined).trim(),
        masterDocument: combined.trim().slice(0, 2500),
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
- Si es "project": Enfatiza arquitectura técnica, problemas resueltos y métricas de impacto (método STAR).
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
}


