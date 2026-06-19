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


export interface OptimizeRequest {
  baseCvMarkdown: string;
  jobDescription: string;
  userSubscriptionStatus: string; // 'active' o 'none'
  promptId?: string;
  candidateName?: string;
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

  static async optimizeCV({ baseCvMarkdown, jobDescription, userSubscriptionStatus, promptId }: OptimizeRequest): Promise<string> {
    const isPro = userSubscriptionStatus === 'active';

    // 1. Cargar el prompt activo o el seleccionado desde la DB si existe
    let systemPrompt: string | null = null;
    let userPromptTemplate: string | null = null;

    try {
      let dbPrompt;
      if (promptId) {
        // Cargar prompt específico seleccionado por el usuario
        [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(eq(prompts.id, promptId))
          .limit(1);
      } else {
        // Cargar el prompt activo por defecto
        [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(and(eq(prompts.key, 'optimize_cv'), eq(prompts.isActive, true)))
          .limit(1);
      }

      if (dbPrompt) {
        systemPrompt = dbPrompt.systemPrompt;
        if (dbPrompt.isStrict) {
          systemPrompt += "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS;
        }
        userPromptTemplate = dbPrompt.userPrompt;
      }
    } catch (err) {
      console.error("[AIService] Error al obtener prompt de la DB:", err);
    }

    if (!isPro) {
      // [FREE] Enrutamiento Plan FREE
      const provider = await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      const model = await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

      const defaultSystem = "Eres un asesor de empleo profesional. Optimiza el CV del usuario de acuerdo a la oferta. Devuelve SOLO el markdown resultante sin explicaciones y sin bloques de código.";
      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS;
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

      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS;
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
    const isPro = userSubscriptionStatus === 'active';

    let systemPrompt: string | null = null;
    let userPromptTemplate: string | null = null;
    let isStrict = false;

    try {
      const [dbPrompt] = await db
        .select()
        .from(prompts)
        .where(and(eq(prompts.key, 'import_cv'), eq(prompts.isActive, true)))
        .limit(1);

      if (dbPrompt) {
        systemPrompt = dbPrompt.systemPrompt;
        isStrict = dbPrompt.isStrict;
        userPromptTemplate = dbPrompt.userPrompt;
      }
    } catch (err) {
      console.error("[AIService] Error al obtener prompt de importación de la DB:", err);
    }

    if (!systemPrompt || !userPromptTemplate) {
      throw new Error("IMPORT_PROMPT_MISSING");
    }

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

  static async optimizeCVStream({ baseCvMarkdown, jobDescription, userSubscriptionStatus, promptId, candidateName }: OptimizeRequest): Promise<ReadableStream<Uint8Array>> {
    const isPro = userSubscriptionStatus === 'active';

    let systemPrompt: string | null = null;
    let userPromptTemplate: string | null = null;

    try {
      let dbPrompt;
      if (promptId) {
        [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(eq(prompts.id, promptId))
          .limit(1);
      } else {
        [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(and(eq(prompts.key, 'optimize_cv'), eq(prompts.isActive, true)))
          .limit(1);
      }

      if (dbPrompt) {
        systemPrompt = dbPrompt.systemPrompt;
        if (dbPrompt.isStrict) {
          systemPrompt += "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS;
        }
        userPromptTemplate = dbPrompt.userPrompt;
      }
    } catch (err) {
      console.error("[AIService] Error al obtener prompt de la DB:", err);
    }

    const resolvedName = this.extractCandidateName(baseCvMarkdown) || candidateName || "Candidato";
    const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: El currículum DEBE comenzar obligatoriamente con el nombre del candidato en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;

    if (!isPro) {
      const provider = await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      const model = await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

      const defaultSystem = "Eres un asesor de empleo profesional. Optimiza el CV del usuario de acuerdo a la oferta. Devuelve SOLO el markdown resultante sin explicaciones y sin bloques de código.";
      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + nameDirective;
      const finalUserPrompt = userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, baseCvMarkdown, jobDescription)
        : `CV Base:\n${baseCvMarkdown}\n\nOferta de Empleo:\n${jobDescription}`;

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

      const finalSystemPrompt = (systemPrompt || defaultSystem) + "\n\n" + MARKDOWN_STRUCTURE_INSTRUCTIONS + nameDirective;
      const finalUserPrompt = userPromptTemplate
        ? this.templatePrompt(userPromptTemplate, baseCvMarkdown, jobDescription)
        : `CV Base:\n${baseCvMarkdown}\n\nOferta de Trabajo:\n${jobDescription}`;

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
    const isPro = userSubscriptionStatus === 'active';

    let systemPrompt: string | null = null;
    let userPromptTemplate: string | null = null;
    let isStrict = false;

    try {
      const [dbPrompt] = await db
        .select()
        .from(prompts)
        .where(and(eq(prompts.key, 'import_cv'), eq(prompts.isActive, true)))
        .limit(1);

      if (dbPrompt) {
        systemPrompt = dbPrompt.systemPrompt;
        isStrict = dbPrompt.isStrict;
        userPromptTemplate = dbPrompt.userPrompt;
      }
    } catch (err) {
      console.error("[AIService] Error al obtener prompt de importación de la DB:", err);
    }

    if (!systemPrompt || !userPromptTemplate) {
      throw new Error("IMPORT_PROMPT_MISSING");
    }

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

  private static async callOpenRouter(
    cv: string, 
    job: string, 
    model: string, 
    systemPrompt: string, 
    userPrompt: string
  ): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key || key.includes("mock-key") || key === "") {
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
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key.includes("mock-key") || key === "") {
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
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.includes("MockKey") || key.includes("mock-key") || key === "") {
      return this.getMockCvResponse(cv, job, `Gemini Oficial (Modelo: ${model})`);
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
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
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de API de Gemini (${response.status}): ${response.statusText || errorText}`);
      }

      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
        throw new Error("La respuesta recibida de Gemini no tiene el formato esperado.");
      }
      return data.candidates[0].content.parts[0].text;
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
    const key = process.env.OPENROUTER_API_KEY;
    if (!key || key.includes("mock-key") || key === "") {
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
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key.includes("mock-key") || key === "") {
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
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.includes("MockKey") || key.includes("mock-key") || key === "") {
      return this.streamMockResponse(cv, job, `Gemini Oficial (Modelo: ${model})`);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${key}`, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error de API de Gemini (${response.status}): ${response.statusText || errorText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    return new ReadableStream({
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.close();
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            const regex = /"text":\s*"((?:[^"\\]|\\.)*)"/g;
            let match;
            let lastIndex = 0;
            let matchedAny = false;
            
            while ((match = regex.exec(buffer)) !== null) {
              matchedAny = true;
              try {
                const rawText = match[1];
                const text = JSON.parse(`"${rawText}"`);
                if (text) {
                  controller.enqueue(encoder.encode(text));
                }
              } catch (e) {
                // Ignore parse errors for incomplete parts
              }
              lastIndex = regex.lastIndex;
            }

            if (matchedAny) {
              buffer = buffer.substring(lastIndex);
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
    const isPro = userSubscriptionStatus === 'active';
    
    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER)
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    // 1. Intentar cargar el prompt activo de star_analyze desde la base de datos
    let dbPrompt;
    try {
      [dbPrompt] = await db
        .select()
        .from(prompts)
        .where(and(eq(prompts.key, 'star_analyze'), eq(prompts.isActive, true)))
        .limit(1);
    } catch (err) {
      console.error("[AIService] Error al obtener prompt star_analyze de la DB:", err);
    }

    const defaultSystem = `Eres un reclutador senior experto de la empresa "{{company}}". Tu tarea es evaluar el currículum del candidato contra la descripción de la oferta de trabajo y responder con un objeto JSON estructurado que contenga un análisis exhaustivo.
Es crítico que respondas única y exclusivamente con el objeto JSON válido, sin preámbulos, sin explicaciones, sin comentarios y sin bloques de código Markdown (no uses triple backticks \`\`\`json). Tu respuesta debe ser directamente parseable por JSON.parse.`;

    const defaultUser = `CV del candidato:
{{cv}}

Descripción de la oferta de trabajo:
{{job}}

Actua como un reclutador senior de esta empresa exacta, analiza mi cv contra esta descripcion de referencia y dame una puntuacion de match sobre 100, las cinco palabras clave que me faltan y las 3 redflags que un responsable de selección pillaría en menos de 10 segundos.

Responde exactamente con este formato JSON:
{
  "score": 38,
  "scoreLabel": "Match bajo — aplicar sin adaptar es tiempo perdido",
  "scoreReason": "El perfil tiene base técnica real, pero la oferta exige un stack muy distinto: Python/FastAPI, arquitecturas event-driven, Snowflake/Databricks y 5+ años en producción. Hay trabajo de adaptación serio antes de enviar.",
  "dimensions": [
    { "name": "Años de experiencia", "percentage": 20 },
    { "name": "Stack backend", "percentage": 30 },
    { "name": "Frontend", "percentage": 55 },
    { "name": "Datos / cloud", "percentage": 5 },
    { "name": "IA / ML infra", "percentage": 40 },
    { "name": "Distributed systems", "percentage": 10 }
  ],
  "missingKeywords": [
    "Python / FastAPI",
    "Celery / pub-sub",
    "Snowflake / Databricks",
    "gRPC / async batching",
    "MLOps / model serving"
  ],
  "presentKeywords": [
    "LLMs", "REST APIs", "Node.js", "Docker", "Angular", "TypeScript"
  ],
  "redFlags": [
    {
      "title": "2 años de experiencia vs. requisito de 5+",
      "description": "La oferta pide \\"5+ years in production environments\\". Tienes 2. No es un matiz — es el primer filtro automático en cualquier ATS y el motivo de descarte más rápido en criba manual."
    },
    {
      "title": "Python y FastAPI ausentes del CV",
      "description": "El stack backend de la oferta es 100% Python/FastAPI/ASGI. Tu CV muestra Node.js y PHP/Laravel — tecnologías válidas, pero no las que el reclutador está buscando cuando escanea en diagonal."
    },
    {
      "title": "Sin trazas de arquitecturas distribuidas ni datos cloud",
      "description": "La oferta repite \\"distributed systems\\", \\"event-driven\\", \\"Snowflake\\", \\"Databricks\\", \\"Celery\\". Tu CV no menciona ninguno. Para alguien que lee 200 CVs, la ausencia de estas palabras es un no inmediato."
    }
  ],
  "verdict": "Mi veredicto como reclutador: esta oferta está diseñada para un perfil senior con experiencia sólida en infraestructura ML distribuida. No es que seas malo — es que el rol tiene requisitos muy específicos que hoy no están en tu CV ni probablemente en tu experiencia real."
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
      if (mcpProfile.additionalNotes) {
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
    const isPro = userSubscriptionStatus === 'active';
    
    const provider = isPro 
      ? await this.getSetting('pro_provider', DEFAULT_PRO_PROVIDER)
      : await this.getSetting('free_provider', DEFAULT_FREE_PROVIDER);
      
    const model = isPro
      ? await this.getSetting('pro_model', getDefaultModelForProvider('pro', provider))
      : await this.getSetting('free_model', getDefaultModelForProvider('free', provider));

    const resolvedName = this.extractCandidateName(cvMarkdown) || candidateName || "Candidato";
    const nameDirective = `\n\n¡REGLA SUPREMA DE NOMBRE!: El currículum DEBE comenzar obligatoriamente con el nombre del candidato en un título de primer nivel: '# ${resolvedName}' seguido de una línea en blanco. Bajo NINGUNA circunstancia uses "CURRICULUM VITAE" o "CV" como título principal.`;

    // 1. Intentar cargar el prompt de star_optimize desde la base de datos
    let dbPrompt;
    try {
      if (promptId) {
        [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(eq(prompts.id, promptId))
          .limit(1);
      } else {
        [dbPrompt] = await db
          .select()
          .from(prompts)
          .where(and(eq(prompts.key, 'star_optimize'), eq(prompts.isActive, true)))
          .limit(1);
      }
    } catch (err) {
      console.error("[AIService] Error al obtener prompt star_optimize de la DB:", err);
    }

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
    const isPro = userSubscriptionStatus === 'active';
    
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
    const isPro = userSubscriptionStatus === 'active';
    const provider = await this.getSetting(isPro ? 'pro_provider' : 'free_provider', isPro ? DEFAULT_FREE_PROVIDER : DEFAULT_FREE_PROVIDER);
    const model = await this.getSetting(isPro ? 'pro_model' : 'free_model', getDefaultModelForProvider(isPro ? 'pro' : 'free', provider));

    let systemPrompt = "Eres un consultor experto en selección y reclutamiento (career coach) de Matchply. Tu misión es analizar el historial de candidaturas (postulaciones de empleo) y currículums del usuario para identificar patrones de rechazo, errores en su perfil o descripción, y proponer un plan de acción concreto y estructurado para mejorar su tasa de conversión en las ofertas. Sé directo, profesional, empático y estructurado en Markdown. No uses saludos excesivamente largos, ve directo al grano and mantén un tono premium y ejecutivo.";
    let userPromptTemplate = "Aquí tienes el reporte de mis candidaturas actuales y los currículums utilizados:\n\n{{report}}\n\nPor favor, analiza en qué estoy fallando y dame consejos específicos para mejorar.";

    try {
      const [dbPrompt] = await db
        .select()
        .from(prompts)
        .where(and(eq(prompts.key, 'analyze_failures'), eq(prompts.isActive, true)))
        .limit(1);

      if (dbPrompt) {
        systemPrompt = dbPrompt.systemPrompt;
        userPromptTemplate = dbPrompt.userPrompt;
      }
    } catch (err) {
      console.error("[AIService] Error al obtener prompt analyze_failures de la DB:", err);
    }

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
}
