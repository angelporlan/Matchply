import { CV_GENERATION_BASE, CV_MODE_BLOCKS, CV_OPTIMIZATION_PROMPT_VERSION } from '@/lib/cv-optimization/prompts';
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
    version: CV_OPTIMIZATION_PROMPT_VERSION,
    name: 'Fiel',
    nameEn: 'Faithful',
    description: 'Conserva tu trayectoria y estructura; ajusta hasta seis viñetas con evidencia real.',
    descriptionEn: 'Preserves your history and structure; adjusts up to six bullets using real evidence.',
    color: '#3b82f6',
    isDefault: true,
    isStrict: true,
    systemPrompt: CV_GENERATION_BASE + '\n\n' + CV_MODE_BLOCKS.optimize_honest,
    userPrompt: `CV Base:
{{cv}}

Oferta de Trabajo:
{{job}}

Optimiza el CV para esta oferta sin añadir información no respaldada por el CV base.`,
  },
  optimize_adapted: {
    id: 'optimize_adapted',
    version: CV_OPTIMIZATION_PROMPT_VERSION,
    name: 'Equilibrado',
    nameEn: 'Balanced',
    description: 'Prioriza la oferta y reformula contenido relevante conservando los hechos.',
    descriptionEn: 'Prioritizes the offer and rewrites relevant content while preserving facts.',
    color: '#f97316',
    isDefault: false,
    isStrict: true,
    systemPrompt: CV_GENERATION_BASE + '\n\n' + CV_MODE_BLOCKS.optimize_adapted,
    userPrompt: `CV Base:
{{cv}}

Oferta de Trabajo:
{{job}}

Adapta el lenguaje del CV a esta oferta sin inventar experiencia, tecnologías ni métricas.`,
  },
  optimize_aggressive: {
    id: 'optimize_aggressive',
    version: CV_OPTIMIZATION_PROMPT_VERSION,
    name: 'Máximo matching',
    nameEn: 'Maximum match',
    description: 'Reestructura y enfatiza al máximo tu experiencia respaldada para esta oferta.',
    descriptionEn: 'Restructures and emphasizes your supported experience for this offer.',
    color: '#ef4444',
    isDefault: false,
    isStrict: true,
    systemPrompt: CV_GENERATION_BASE + '\n\n' + CV_MODE_BLOCKS.optimize_aggressive,
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
