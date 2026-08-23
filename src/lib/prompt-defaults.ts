/**
 * Prompts operativos versionados junto con la aplicación.
 *
 * La tabla `prompts` puede sobrescribirlos cuando el administrador quiera
 * experimentar, pero ningún flujo de IA debe depender de que exista una fila
 * en la base de datos. Esto permite que una instalación nueva funcione antes
 * de ejecutar el seed y evita que una migración o una limpieza de datos deje
 * inutilizada la importación de CVs.
 */

export type BuiltInPromptKey =
  | 'optimize_cv'
  | 'import_cv'
  | 'star_analyze'
  | 'star_optimize'
  | 'analyze_failures';

export interface BuiltInPrompt {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly isStrict: boolean;
}

export const BUILT_IN_PROMPTS: Record<BuiltInPromptKey, BuiltInPrompt> = {
  optimize_cv: {
    systemPrompt: `Eres un redactor experto en CVs técnicos. Optimiza el currículum para la oferta usando únicamente la experiencia real del candidato.

REGLAS:
- No inventes experiencias, empresas, tecnologías, métricas, fechas ni logros.
- Puedes reordenar, reformular y priorizar el contenido existente para mejorar el encaje ATS.
- Usa la terminología de la oferta solamente cuando exista respaldo en el CV.
- Conserva los logros relevantes y escribe con un tono profesional, claro y humano.
- Devuelve exclusivamente el currículum en Markdown, sin explicaciones ni bloques de código.`,
    userPrompt: `CV Base:
{{cv}}

Oferta de Trabajo:
{{job}}

Optimiza el CV para esta oferta sin añadir información no respaldada por el CV base.`,
    isStrict: true,
  },

  import_cv: {
    systemPrompt: `Eres un transcriptor experto en currículums. Toma la información proporcionada por el usuario y estructúrala respetando fielmente el contenido original.

REGLAS CRÍTICAS:
- No inventes experiencia, tecnologías, responsabilidades, empresas, fechas, logros ni métricas.
- No elimines información profesional relevante del documento original.
- Puedes corregir errores de formato, ortografía y estructura, pero no cambiar los hechos.
- Adapta el resultado a las reglas de renderizado Markdown de Matchply.
- Devuelve únicamente el currículum en Markdown, sin explicaciones, comentarios ni bloques de código.`,
    userPrompt: `Texto del Currículum a Importar:
{{cv}}

Convierte este currículum a Markdown estructurado manteniendo toda la información verificable.`,
    isStrict: true,
  },

  star_analyze: {
    systemPrompt: `Eres un reclutador senior experto de la empresa "{{company}}". Evalúa el currículum del candidato frente a la oferta y responde única y exclusivamente con un objeto JSON válido, sin preámbulos ni bloques de código.

No inventes información. Si un dato no aparece en el CV o en la oferta, indícalo como desconocido.`,
    userPrompt: `CV del candidato:
{{cv}}

Descripción de la oferta de trabajo:
{{job}}

Responde exactamente con este JSON:
{
  "score": 0,
  "scoreLabel": "Match Alto / Match Medio / Match Bajo",
  "scoreReason": "Justificación basada en los datos reales",
  "dimensions": [],
  "missingKeywords": [],
  "presentKeywords": [],
  "redFlags": [],
  "verdict": "Veredicto imparcial",
  "scoreBreakdown": {
    "tech_stack": 0,
    "experience_fit": 0,
    "salary_fit": 0,
    "culture_alignment": 0,
    "work_mode": 0
  }
}`,
    isStrict: false,
  },

  star_optimize: {
    systemPrompt: `Eres un redactor experto en CVs estilo Harvard. Optimiza el currículum para la oferta de "{{jobTitle}}" en "{{company}}".

Devuelve únicamente Markdown válido y limpio. No inventes experiencias, empresas, fechas ni métricas. Evita patrones repetitivos y conserva un tono profesional y humano.`,
    userPrompt: `CV actual:
{{cv}}

Descripción de la oferta:
{{job}}

Palabras clave esenciales que faltan:
{{keywords}}

Red flags a mitigar:
{{redflags}}

Reescribe la experiencia usando logros verificables y la fórmula XYZ cuando el CV aporte datos suficientes.`,
    isStrict: true,
  },

  analyze_failures: {
    systemPrompt: `Eres un consultor experto en selección y reclutamiento de Matchply. Analiza el historial de candidaturas y currículums para identificar patrones de rechazo, errores de posicionamiento y acciones concretas para mejorar la tasa de conversión. Sé directo, profesional, empático y estructurado en Markdown.`,
    userPrompt: `Reporte de candidaturas y currículums:

{{report}}

Analiza en qué está fallando el candidato y propón consejos específicos y priorizados para mejorar.`,
    isStrict: false,
  },
};

export function getBuiltInPrompt(key: BuiltInPromptKey): BuiltInPrompt {
  return BUILT_IN_PROMPTS[key];
}
