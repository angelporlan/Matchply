const COMMON_FIDELITY = `REGLAS DE FIDELIDAD (obligatorias en todos los modos):
- No inventes experiencia, empresas, tecnologías, responsabilidades, fechas, logros ni métricas.
- No conviertas conocimiento adyacente en experiencia directa.
- Conserva el nivel de evidencia del CV base. Si una palabra clave de la oferta no está respaldada, no la añadas.`;

export const OPTIMIZE_MODE_IDS = ['optimize_honest', 'optimize_adapted', 'optimize_aggressive'] as const;
export type OptimizeModeId = typeof OPTIMIZE_MODE_IDS[number];

export type OptimizeMode = {
  id: OptimizeModeId;
  version: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  color: string;
  isDefault: boolean;
  isStrict: boolean;
  systemPrompt: string;
  userPrompt: string;
};

export const OPTIMIZE_MODES: Record<OptimizeModeId, OptimizeMode> = {
  optimize_honest: {
    id: 'optimize_honest',
    version: '2026-09-20.1',
    name: 'Modo Honesto',
    nameEn: 'Honest Mode',
    description: 'Optimización estricta basada únicamente en el contenido de tu CV. No añade habilidades ni experiencias que no estén en el documento.',
    descriptionEn: 'Strict optimization based solely on your CV content. Does not add skills or experiences that are not in the document.',
    color: '#3b82f6',
    isDefault: true,
    isStrict: true,
    systemPrompt: `Eres un redactor experto en CVs técnicos. Tu única fuente de verdad es el CV que te proporciona el usuario.

${COMMON_FIDELITY}
- No infieras ni supongas habilidades. Si no está escrito, no existe.
- Puedes reordenar, reformular y priorizar lo que ya existe para alinearlo con la oferta.
- Usa verbos de acción y lenguaje profesional.
- Extrae las 5 palabras clave más importantes de la oferta y úsalas solo donde haya respaldo real en el CV.
- Devuelve exclusivamente el currículum en Markdown, sin explicaciones ni bloques de código.`,
    userPrompt: `CV Base:
{{cv}}

Oferta de Trabajo:
{{job}}

Optimiza el CV para esta oferta sin añadir información no respaldada por el CV base.`,
  },
  optimize_adapted: {
    id: 'optimize_adapted',
    version: '2026-09-20.1',
    name: 'Modo Adaptado',
    nameEn: 'Adapted Mode',
    description: 'Reformula y destaca habilidades equivalentes y transferibles usando la terminología de la oferta, sin inventar experiencia ni métricas.',
    descriptionEn: 'Reformulates and highlights equivalent transferable skills using the offer wording, without inventing experience or metrics.',
    color: '#f97316',
    isDefault: false,
    isStrict: true,
    systemPrompt: `Eres un redactor experto en CVs técnicos. Optimiza el CV para la oferta dada.

${COMMON_FIDELITY}
- Sí puedes reformular habilidades existentes usando la terminología de la oferta cuando sean equivalentes (ej: "integración de APIs" → "diseño de REST APIs" si el CV ya describe ese trabajo).
- Sí puedes destacar habilidades transferibles que el candidato ya evidencia, aunque no las haya nombrado con las mismas palabras.
- No añadas tecnologías, herramientas ni métricas que no estén en el CV.
- Extrae las 5 palabras clave más importantes de la oferta y úsalas para priorizar la estructura.
- Devuelve exclusivamente el currículum en Markdown, sin explicaciones ni bloques de código.`,
    userPrompt: `CV Base:
{{cv}}

Oferta de Trabajo:
{{job}}

Adapta el lenguaje del CV a esta oferta sin inventar experiencia, tecnologías ni métricas.`,
  },
  optimize_aggressive: {
    id: 'optimize_aggressive',
    version: '2026-09-20.1',
    name: 'Modo Agresivo',
    nameEn: 'Aggressive Mode',
    description: 'Reescribe con el lenguaje de la oferta y maximiza el encaje ATS reordenando y enfatizando evidencia real. No inventa experiencia ni métricas.',
    descriptionEn: 'Rewrites with the offer language and maximizes ATS fit by reordering real evidence. Does not invent experience or metrics.',
    color: '#ef4444',
    isDefault: false,
    isStrict: true,
    systemPrompt: `Eres un reclutador experto y redactor de CVs de alto impacto. Reescribe el CV para maximizar el encaje con el puesto usando únicamente evidencia del CV base.

${COMMON_FIDELITY}
- Prioriza el alineamiento léxico con la oferta reordenando y reformulando contenido real.
- No añadas tecnologías, herramientas, contextos ni cifras que no aparezcan en el CV.
- El perfil profesional, la experiencia y las habilidades deben resonar con el lenguaje de la oferta sin alterar los hechos.
- El resultado debe sonar auténtico, profesional y convincente.
- Devuelve exclusivamente el currículum en Markdown, sin explicaciones ni bloques de código.`,
    userPrompt: `CV Base:
{{cv}}

Oferta de Trabajo:
{{job}}

Reescribe el CV para esta oferta maximizando el encaje ATS sin inventar experiencia, tecnologías ni métricas.`,
  },
};

export const LEGACY_PROMPT_NAME_TO_MODE: Record<string, OptimizeModeId> = {
  'Modo Honesto': 'optimize_honest',
  'Honest Mode': 'optimize_honest',
  'Modo Adaptado': 'optimize_adapted',
  'Adapted Mode': 'optimize_adapted',
  'Modo Agresivo': 'optimize_aggressive',
  'Aggressive Mode': 'optimize_aggressive',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOptimizeModeId(value: string): value is OptimizeModeId {
  return (OPTIMIZE_MODE_IDS as readonly string[]).includes(value);
}

export function looksLikeLegacyPromptId(value: string) {
  return UUID_RE.test(value);
}

export function listOptimizeModes(): OptimizeMode[] {
  return OPTIMIZE_MODE_IDS.map((id) => OPTIMIZE_MODES[id]);
}

export function getDefaultOptimizeMode(): OptimizeMode {
  return OPTIMIZE_MODES.optimize_honest;
}

export function resolveOptimizeModeFromName(name?: string | null): OptimizeModeId | null {
  if (!name) return null;
  return LEGACY_PROMPT_NAME_TO_MODE[name.trim()] || null;
}

export type PublicOptimizeMode = Pick<
  OptimizeMode,
  'id' | 'name' | 'nameEn' | 'description' | 'descriptionEn' | 'color' | 'isDefault'
> & { isActive: boolean };

export function publicOptimizeModes(): PublicOptimizeMode[] {
  return listOptimizeModes().map((mode) => ({
    id: mode.id,
    name: mode.name,
    nameEn: mode.nameEn,
    description: mode.description,
    descriptionEn: mode.descriptionEn,
    color: mode.color,
    isDefault: mode.isDefault,
    isActive: mode.isDefault,
  }));
}
