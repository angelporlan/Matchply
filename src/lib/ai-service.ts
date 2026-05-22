export interface OptimizeRequest {
  baseCvMarkdown: string;
  jobDescription: string;
  userSubscriptionStatus: string; // 'active' o 'none'
}

export class AIService {
  static async optimizeCV({ baseCvMarkdown, jobDescription, userSubscriptionStatus }: OptimizeRequest): Promise<string> {
    const isPro = userSubscriptionStatus === 'active';

    if (!isPro) {
      // 🟢 Enrutamiento Plan FREE (OpenRouter)
      return await this.callOpenRouter(baseCvMarkdown, jobDescription);
    } else {
      // 💎 Enrutamiento Plan PRO (DeepSeek o Gemini Oficial)
      const provider = process.env.PREFERRED_PRO_PROVIDER || 'deepseek';
      if (provider === 'gemini') {
        return await this.callGeminiOficial(baseCvMarkdown, jobDescription);
      } else {
        return await this.callDeepSeekOficial(baseCvMarkdown, jobDescription);
      }
    }
  }

  private static async callOpenRouter(cv: string, job: string): Promise<string> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key || key.includes("mock-key") || key === "") {
      throw new Error("No se ha configurado una clave de API de OpenRouter válida.");
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: "Eres un asesor de empleo profesional. Optimiza el CV del usuario de acuerdo a la oferta. Devuelve SOLO el markdown resultante sin explicaciones y sin bloques de código."
            },
            {
              role: "user",
              content: `CV Base:\n${cv}\n\nOferta de Empleo:\n${job}`
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

  private static async callDeepSeekOficial(cv: string, job: string): Promise<string> {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key || key.includes("mock-key") || key === "") {
      throw new Error("No se ha configurado una clave de API de DeepSeek válida.");
    }

    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "Eres un redactor experto en CVs estilo Harvard. Analiza la oferta e integra sutilmente las palabras clave, destacando los logros medibles (método STAR) basados en la experiencia real provista en el CV Base. No inventes experiencias que no estén en el CV base, solo optimiza la redacción y priorización de las mismas. Devuelve el resultado exclusivamente en formato Markdown estructurado válido, sin bloques de código ni explicaciones."
            },
            {
              role: "user",
              content: `CV Base:\n${cv}\n\nOferta de Trabajo:\n${job}`
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

  private static async callGeminiOficial(cv: string, job: string): Promise<string> {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key.includes("MockKey") || key.includes("mock-key") || key === "") {
      throw new Error("No se ha configurado una clave de API de Gemini válida.");
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Eres un redactor experto de CVs estilo Harvard. Toma el siguiente CV Base y optimízalo detalladamente para encajar con los requisitos de la Oferta de Trabajo. Incrementa el match semántico, prioriza secciones relevantes y utiliza el método STAR para describir logros. Devuelve la salida en Markdown limpio sin bloques de código tipo triple backtick.\n\nCV Base:\n${cv}\n\nOferta de Trabajo:\n${job}`
            }]
          }],
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
    // Extrae el nombre, contacto y secciones del CV original
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
    
    // Simular un acoplamiento estratégico con la oferta
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
**NextProf AI Corp** | *2024 - Presente*
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
