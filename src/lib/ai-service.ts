import { db } from '@/db';
import { settings, prompts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const MARKDOWN_STRUCTURE_INSTRUCTIONS = `
¡REGLA DE ESTRUCTURA Y FORMATO CRÍTICA PARA EL RENDERIZADO DE PDF!:
Debes devolver el currículum formateado estrictamente bajo las siguientes especificaciones de Markdown para que el motor de PDF pueda parsearlo e imprimirlo correctamente. De lo contrario, se romperá el diseño visual del PDF.

1. ENCABEZADO DE CONTACTO (Al inicio del documento, antes de cualquier sección '##'):
   - Las líneas de contacto deben estar en una o dos líneas al principio, formateadas usando el separador ' | ' y negrita para los nombres de los campos.
   - Ejemplo exacto:
     **Email:** angelporlandev@gmail.com | **Teléfono:** +34 652 68 49 26 | **Ubicación:** Murcia, España
     **LinkedIn:** linkedin.com/in/angelporlan | **GitHub:** github.com/angelporlan | **Web:** angelporlan.vercel.app

2. SECCIONES PRINCIPALES:
   - Deben empezar siempre con '## ' (ejemplo: ## Experiencia Profesional, ## Educación, ## Habilidades Técnicas, ## Perfil Profesional).

3. ENTRADAS DE EXPERIENCIA, EDUCACIÓN O PROYECTOS (ESTRUCTURA OBLIGATORIA EN DOS LÍNEAS):
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

4. SECCIÓN DE HABILIDADES:
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
}

export class AIService {
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
      const provider = await this.getSetting('free_provider', 'openrouter');
      const model = await this.getSetting('free_model', 'openrouter/free');

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
      const defaultProProvider = process.env.PREFERRED_PRO_PROVIDER || 'deepseek';
      const provider = await this.getSetting('pro_provider', defaultProProvider);
      
      const defaultProModel = provider === 'gemini' ? 'gemini-1.5-pro' : 'deepseek-chat';
      const model = await this.getSetting('pro_model', defaultProModel);

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
}
